package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"auth/internal/utils"

	"github.com/golang-jwt/jwt/v4"
)

func init() {
	os.Setenv("SECRET_KEY_BASE", "testsecret")
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
