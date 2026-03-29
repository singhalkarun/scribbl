package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

// TestCORSMiddleware tests basic CORS header handling
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

		rec := httptest.NewRecorder()
		corsHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("Expected 204 for preflight, got %d", rec.Code)
		}

		// Check that basic CORS headers are present
		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
			t.Errorf("Expected Access-Control-Allow-Origin to be http://localhost:3000, got %s", rec.Header().Get("Access-Control-Allow-Origin"))
		}
		if rec.Header().Get("Access-Control-Allow-Methods") == "" {
			t.Error("Expected Access-Control-Allow-Methods to be set")
		}
		if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
			t.Error("Expected Access-Control-Allow-Credentials to be true")
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

// TestCORSMiddlewareEnvironments tests environment-specific CORS behavior
func TestCORSMiddlewareEnvironments(t *testing.T) {
	// Save original environment values
	originalCORS := os.Getenv("CORS_ALLOWED_ORIGINS")
	originalAppEnv := os.Getenv("APP_ENV")

	// Clean up after test
	defer func() {
		os.Setenv("CORS_ALLOWED_ORIGINS", originalCORS)
		os.Setenv("APP_ENV", originalAppEnv)
	}()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	t.Run("production environment with explicit CORS_ALLOWED_ORIGINS", func(t *testing.T) {
		os.Setenv("CORS_ALLOWED_ORIGINS", "https://example.com,https://www.example.com")
		os.Setenv("APP_ENV", "production")

		corsHandler := CorsMiddleware(testHandler)

		req := httptest.NewRequest("POST", "/test", nil)
		req.Header.Set("Origin", "https://example.com")

		rec := httptest.NewRecorder()
		corsHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", rec.Code)
		}

		if rec.Header().Get("Access-Control-Allow-Origin") != "https://example.com" {
			t.Error("Expected explicit origin to be allowed in production")
		}
	})

	t.Run("production environment should reject localhost", func(t *testing.T) {
		os.Setenv("CORS_ALLOWED_ORIGINS", "https://example.com")
		os.Setenv("APP_ENV", "production")

		corsHandler := CorsMiddleware(testHandler)

		req := httptest.NewRequest("POST", "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")

		rec := httptest.NewRecorder()
		corsHandler.ServeHTTP(rec, req)

		// Should still return 200 but without CORS headers for disallowed origin
		if rec.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", rec.Code)
		}

		if rec.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Error("Expected localhost to be rejected in production with explicit origins")
		}
	})
}
