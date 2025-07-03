package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"auth/internal/container"
)

func TestAuthHandlers(t *testing.T) {
	// Set required environment variables for JWT generation
	originalSecretKey := os.Getenv("SECRET_KEY_BASE")
	os.Setenv("SECRET_KEY_BASE", "test_secret_key_for_handlers_testing")
	defer func() {
		if originalSecretKey == "" {
			os.Unsetenv("SECRET_KEY_BASE")
		} else {
			os.Setenv("SECRET_KEY_BASE", originalSecretKey)
		}
	}()

	// Create test container with services
	testContainer := container.CreateTestContainer()
	defer testContainer.Shutdown()

	// Create handlers
	handlers := NewHandlersFromContainer(testContainer)

	t.Run("RequestOTP success", func(t *testing.T) {
		reqBody := RequestOTPRequest{
			Phone: testContainer.GetTestPhoneNumber(),
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handlers.Auth.RequestOTPHandler(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var response AuthResponse
		err := json.NewDecoder(w.Body).Decode(&response)
		if err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response.Message != "OTP sent successfully" {
			t.Errorf("Expected success message, got %s", response.Message)
		}
	})

	t.Run("RequestOTP invalid phone", func(t *testing.T) {
		reqBody := RequestOTPRequest{
			Phone: "invalid-phone",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handlers.Auth.RequestOTPHandler(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d", w.Code)
		}
	})

	t.Run("VerifyOTP success", func(t *testing.T) {
		// First request OTP
		testPhone := testContainer.GetTestPhoneNumber()
		testOTP := testContainer.GetTestOTP()

		// Request OTP first
		authService := testContainer.GetServices().Auth
		err := authService.RequestOTP(testPhone)
		if err != nil {
			t.Fatalf("Failed to request OTP: %v", err)
		}

		// Now verify OTP
		reqBody := VerifyOTPRequest{
			Phone: testPhone,
			OTP:   testOTP,
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handlers.Auth.VerifyOTPHandler(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var response map[string]interface{}
		err = json.NewDecoder(w.Body).Decode(&response)
		if err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["message"] != "Authentication successful" {
			t.Errorf("Expected authentication success message")
		}

		if response["token"] == nil {
			t.Error("Expected JWT token in response")
		}

		if response["user"] == nil {
			t.Error("Expected user in response")
		}
	})
}

// Helper types for testing
type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}

func TestErrorClassification(t *testing.T) {
	t.Run("isValidationError", func(t *testing.T) {
		testCases := []struct {
			error    string
			expected bool
		}{
			{"validation error: invalid phone", true},
			{"invalid phone number format", true},
			{"invalid OTP format", true},
			{"phone number is required", true},
			{"database connection failed", false},
			{"internal server error", false},
		}

		for _, tc := range testCases {
			err := &testError{msg: tc.error}
			result := isValidationError(err)
			if result != tc.expected {
				t.Errorf("For error '%s', expected %v, got %v", tc.error, tc.expected, result)
			}
		}
	})

	t.Run("isAuthenticationError", func(t *testing.T) {
		testCases := []struct {
			error    string
			expected bool
		}{
			{"invalid OTP", true},
			{"expired OTP", true},
			{"OTP verification failed", true},
			{"authentication failed", true},
			{"database connection failed", false},
			{"validation error", false},
		}

		for _, tc := range testCases {
			err := &testError{msg: tc.error}
			result := isAuthenticationError(err)
			if result != tc.expected {
				t.Errorf("For error '%s', expected %v, got %v", tc.error, tc.expected, result)
			}
		}
	})
}
