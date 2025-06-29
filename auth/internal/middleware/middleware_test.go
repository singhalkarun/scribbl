package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"auth/internal/storage"
	"auth/internal/utils"

	"github.com/golang-jwt/jwt/v4"
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

// TestCORSMiddleware tests CORS header handling
func TestCORSMiddleware(t *testing.T) {
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	corsHandler := CorsMiddleware(testHandler)

	t.Run("preflight request", func(t *testing.T) {
		req := httptest.NewRequest("OPTIONS", "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Access-Control-Request-Method", "POST")
		req.Header.Set("Access-Control-Request-Headers", "Content-Type")

		rec := httptest.NewRecorder()
		corsHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("Expected 200 for preflight, got %d", rec.Code)
		}

		// Check CORS headers
		expectedHeaders := map[string]string{
			"Access-Control-Allow-Origin":      "http://localhost:3000", // Specific origin, not *
			"Access-Control-Allow-Methods":     "POST, OPTIONS",
			"Access-Control-Allow-Headers":     "Content-Type, Authorization",
			"Access-Control-Allow-Credentials": "true", // true, not false
		}

		for header, expected := range expectedHeaders {
			actual := rec.Header().Get(header)
			if actual != expected {
				t.Errorf("Header %s: expected '%s', got '%s'", header, expected, actual)
			}
		}
	})

	t.Run("regular request", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")

		rec := httptest.NewRecorder()
		corsHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", rec.Code)
		}

		// Check that CORS headers are set for regular requests too
		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
			t.Error("Missing CORS headers on regular request")
		}
	})
}

// TestAuthMiddleware tests JWT authentication middleware
func TestAuthMiddleware(t *testing.T) {
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		phone, ok := GetUserPhoneFromContext(r.Context())
		if !ok {
			t.Error("Phone not found in context")
		}
		if phone != "+919876543210" {
			t.Errorf("Expected phone +919876543210, got %s", phone)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("authenticated"))
	})

	authHandler := AuthMiddleware(testHandler)

	t.Run("valid JWT token", func(t *testing.T) {
		// Generate valid JWT
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"phone": "+919876543210",
			"exp":   time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := token.SignedString([]byte("testsecret"))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)

		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", rec.Code)
		}
	})

	t.Run("missing authorization header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)

		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("Expected 401, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "Authorization header is required" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})

	t.Run("invalid token format", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "InvalidFormat")

		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("Expected 401, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "Bearer token is required" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})

	t.Run("invalid JWT token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer invalidtoken")

		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("Expected 401, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if !strings.Contains(errorResp.Message, "Invalid token") {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})

	t.Run("expired JWT token", func(t *testing.T) {
		// Generate expired JWT
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"phone": "+919876543210",
			"exp":   time.Now().Add(-time.Hour).Unix(), // Expired
		})
		tokenString, _ := token.SignedString([]byte("testsecret"))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)

		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("Expected 401, got %d", rec.Code)
		}
	})
}
