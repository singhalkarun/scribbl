// auth_integration_test.go - Integration tests for the complete authentication API
//
// These tests verify the entire authentication flow from HTTP request to response,
// testing the service as a black box without internal package dependencies.
//
// Tests cover:
// - Complete OTP request/verify flow
// - User management endpoints with JWT authentication
// - Error scenarios and edge cases
// - Rate limiting and CORS behavior
//
// To run: go test -v ./test/integration (Redis and proper environment must be available)

package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"auth/internal/handlers"
	"auth/internal/middleware"
	"auth/internal/storage"

	"github.com/golang-jwt/jwt/v4"
)

func init() {
	// Set test environment
	os.Setenv("SECRET_KEY_BASE", "testsecret")
	os.Setenv("TWO_FACTOR_API_KEY", "test")
	os.Setenv("OTP_TEMPLATE_NAME", "test")
}

// methodHandler wraps a handler to only accept specific HTTP methods (copied from main.go)
func methodHandler(method string, handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			w.Header().Set("Allow", method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}
}

// setupTestServer creates a test server with the actual application setup
func setupTestServer() *httptest.Server {
	// Initialize storage
	storage.InitRedis()

	// Create server with actual route setup (same as main.go)
	return httptest.NewServer(createTestHandler())
}

func createTestHandler() http.Handler {
	// Setup HTTP routes exactly like main.go
	mux := http.NewServeMux()
	mux.Handle("/auth/request-otp", middleware.CorsMiddleware(middleware.RateLimitMiddleware(http.HandlerFunc(handlers.RequestOTPHandler))))
	mux.Handle("/auth/verify-otp", middleware.CorsMiddleware(http.HandlerFunc(handlers.VerifyOTPHandler)))

	// Protected user endpoints
	mux.Handle("/auth/user", middleware.CorsMiddleware(middleware.AuthMiddleware(methodHandler("GET", handlers.GetUserHandler))))
	mux.Handle("/auth/user/update", middleware.CorsMiddleware(middleware.AuthMiddleware(methodHandler("PUT", handlers.UpdateUserHandler))))

	// Add health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"auth"}`))
	})

	return mux
}

func flushRedis() {
	storage.RedisClient.FlushDB(storage.GetContext())
}

// TestCompleteAuthFlow tests the complete authentication workflow
func TestCompleteAuthFlow(t *testing.T) {
	server := setupTestServer()
	defer server.Close()
	client := server.Client()

	flushRedis()

	phone := "+19999999999" // Use test phone number

	t.Run("request OTP", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"phone": phone})
		resp, err := client.Post(server.URL+"/auth/request-otp", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("Failed to request OTP: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("verify OTP and get JWT", func(t *testing.T) {
		// Use the known test OTP for the test phone number
		testOTP := "7415" // Fixed OTP for test phone +19999999999

		// Verify with the known test OTP
		body, _ := json.Marshal(map[string]string{"phone": phone, "otp": testOTP})
		resp, err := client.Post(server.URL+"/auth/verify-otp", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("Failed to verify OTP: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["token"] == nil {
			t.Fatalf("Expected JWT token in response")
		}
	})
}

// TestUserManagementFlow tests the user management endpoints
func TestUserManagementFlow(t *testing.T) {
	server := setupTestServer()
	defer server.Close()
	client := server.Client()

	phone := "+19999999999" // Use test phone number

	// Generate a test JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"phone": phone,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString([]byte("testsecret"))

	t.Run("get user profile", func(t *testing.T) {
		req, _ := http.NewRequest("GET", server.URL+"/auth/user", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)

		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to get user: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("update user name", func(t *testing.T) {
		updateData := map[string]string{"name": "John Doe"}
		jsonData, _ := json.Marshal(updateData)

		req, _ := http.NewRequest("PUT", server.URL+"/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+tokenString)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to update user: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}
	})
}

// TestRateLimiting tests the rate limiting behavior
func TestRateLimiting(t *testing.T) {
	server := setupTestServer()
	defer server.Close()
	client := server.Client()

	flushRedis()

	phone := "+19999999999" // Use test phone number
	body, _ := json.Marshal(map[string]string{"phone": phone})

	// Make 5 requests (should succeed)
	for i := 0; i < 5; i++ {
		resp, err := client.Post(server.URL+"/auth/request-otp", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("Request %d failed: %v", i+1, err)
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Request %d: expected 200, got %d", i+1, resp.StatusCode)
		}
	}

	// 6th request should be rate limited
	resp, err := client.Post(server.URL+"/auth/request-otp", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("Rate limit test failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("Expected 429, got %d", resp.StatusCode)
	}
}

// TestCORSHeaders tests CORS functionality
func TestCORSHeaders(t *testing.T) {
	server := setupTestServer()
	defer server.Close()
	client := server.Client()

	// Test preflight request
	req, _ := http.NewRequest("OPTIONS", server.URL+"/auth/request-otp", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("CORS preflight failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected 200 for preflight, got %d", resp.StatusCode)
	}

	// Check CORS headers
	if resp.Header.Get("Access-Control-Allow-Origin") == "" {
		t.Error("Missing Access-Control-Allow-Origin header")
	}
}
