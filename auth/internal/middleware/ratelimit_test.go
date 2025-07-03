package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"auth/internal/storage"
	"auth/internal/utils"
)

func init() {
	os.Setenv("SECRET_KEY_BASE", "testsecret")
}

func setupRedisForTests() {
	storage.InitRedis()
	storage.RedisClient.FlushDB(storage.GetContext())
}

// TestRateLimitMiddleware tests the rate limiting functionality
func TestRateLimitMiddleware(t *testing.T) {
	setupRedisForTests()

	// Create a test handler
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	// Wrap with rate limit middleware
	rateLimitedHandler := RateLimitMiddleware(testHandler)

	// Make 5 requests (should all succeed) - use /auth/request-otp endpoint for rate limiting
	phone := "+919876543210"
	for i := 0; i < 5; i++ {
		reqBody := fmt.Sprintf(`{"phone":"%s"}`, phone)
		req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader([]byte(reqBody)))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "127.0.0.1:12345" // Same IP for all requests

		rec := httptest.NewRecorder()
		rateLimitedHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("Request %d: expected 200, got %d", i+1, rec.Code)
		}
	}

	// 6th request should be rate limited
	reqBody := fmt.Sprintf(`{"phone":"%s"}`, phone)
	req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader([]byte(reqBody)))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "127.0.0.1:12345"

	rec := httptest.NewRecorder()
	rateLimitedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("Expected 429 on rate limit, got %d", rec.Code)
	}

	// Verify JSON error response
	var errorResp utils.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&errorResp); err != nil {
		t.Fatalf("Failed to decode rate limit response: %v", err)
	}

	if errorResp.Error != "TOO_MANY_REQUESTS" {
		t.Errorf("Expected 'TOO_MANY_REQUESTS', got '%s'", errorResp.Error)
	}
}

// TestRateLimitBodyReconstruction tests that rate limiting properly handles request body
func TestRateLimitBodyReconstruction(t *testing.T) {
	setupRedisForTests()

	// Handler that checks the request body
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var data map[string]string
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			utils.SendJSONError(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		if data["phone"] != "+919876543210" {
			utils.SendJSONError(w, "Body not reconstructed properly", http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	rateLimitedHandler := RateLimitMiddleware(testHandler)

	// Test that body is properly reconstructed after rate limit check
	req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader([]byte(`{"phone":"+919876543210"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "127.0.0.1:54321"

	rec := httptest.NewRecorder()
	rateLimitedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}
}
