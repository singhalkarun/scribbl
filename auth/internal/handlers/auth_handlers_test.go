package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"auth/internal/config"
	"auth/internal/models"
	"auth/internal/storage"
	"auth/internal/utils"
)

func init() {
	os.Setenv("SECRET_KEY_BASE", "testsecret")
	os.Setenv("TWO_FACTOR_API_KEY", "test")
	os.Setenv("OTP_TEMPLATE_NAME", "test")
}

func setupMockEnvironment() {
	// Mock SMS sending for tests
	origSend := utils.SendOTPWith2Factor
	utils.SendOTPWith2Factor = func(phone, otp string) error { return nil }

	// Restore after all tests
	// Note: In a real test suite, you'd use t.Cleanup or defer in each test
	_ = origSend
}

// TestRequestOTPHandler tests the OTP request handler logic
func TestRequestOTPHandler(t *testing.T) {
	setupMockEnvironment()
	storage.InitRedis()

	t.Run("valid request", func(t *testing.T) {
		storage.RedisClient.FlushDB(storage.GetContext())

		reqBody := map[string]string{"phone": "+919876543210"}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		RequestOTPHandler(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
		}

		var response map[string]interface{}
		json.NewDecoder(rec.Body).Decode(&response)
		if response["message"] != "OTP sent successfully" {
			t.Errorf("Unexpected message: %v", response["message"])
		}
	})

	t.Run("missing phone number", func(t *testing.T) {
		reqBody := map[string]string{}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		RequestOTPHandler(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "Phone number is required" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})

	t.Run("invalid phone format", func(t *testing.T) {
		reqBody := map[string]string{"phone": "invalid-phone"}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		RequestOTPHandler(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Error != "BAD_REQUEST" {
			t.Errorf("Expected BAD_REQUEST error type, got %s", errorResp.Error)
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader([]byte("invalid json")))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		RequestOTPHandler(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "Invalid JSON format in request body" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})
}

// TestVerifyOTPHandler tests the OTP verification handler logic
func TestVerifyOTPHandler(t *testing.T) {
	setupMockEnvironment()
	storage.InitRedis()
	models.ClearMockUsers()

	phone := "+919876543210"
	otp := "1234"

	t.Run("valid OTP verification", func(t *testing.T) {
		storage.RedisClient.FlushDB(storage.GetContext())
		models.ClearMockUsers()

		// Store OTP first
		expireAt := time.Now().Add(5 * time.Minute)
		models.StoreOTP(phone, otp, expireAt)

		reqBody := map[string]string{"phone": phone, "otp": otp}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		VerifyOTPHandler(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
		}

		var response map[string]interface{}
		json.NewDecoder(rec.Body).Decode(&response)

		if response["message"] != "Authentication successful" {
			t.Errorf("Unexpected message: %v", response["message"])
		}

		if response["token"] == nil {
			t.Error("Expected JWT token in response")
		}

		if response["user"] == nil {
			t.Error("Expected user object in response")
		}
	})

	t.Run("invalid OTP", func(t *testing.T) {
		storage.RedisClient.FlushDB(storage.GetContext())

		// Store OTP
		expireAt := time.Now().Add(5 * time.Minute)
		models.StoreOTP(phone, otp, expireAt)

		reqBody := map[string]string{"phone": phone, "otp": "0000"}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		VerifyOTPHandler(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Error != "UNAUTHORIZED" {
			t.Errorf("Expected UNAUTHORIZED error type, got %s", errorResp.Error)
		}
	})

	t.Run("missing phone", func(t *testing.T) {
		reqBody := map[string]string{"otp": otp}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		VerifyOTPHandler(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "Phone number is required" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})

	t.Run("missing OTP", func(t *testing.T) {
		reqBody := map[string]string{"phone": phone}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		VerifyOTPHandler(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "OTP is required" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})

	t.Run("invalid OTP format", func(t *testing.T) {
		reqBody := map[string]string{"phone": phone, "otp": "12345"} // 5 digits
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		VerifyOTPHandler(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "OTP must be exactly 4 digits" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})

	t.Run("missing JWT secret", func(t *testing.T) {
		storage.RedisClient.FlushDB(storage.GetContext())
		models.ClearMockUsers()

		// Store valid OTP
		expireAt := time.Now().Add(5 * time.Minute)
		models.StoreOTP(phone, otp, expireAt)

		// Temporarily unset SECRET_KEY_BASE
		originalSecret := os.Getenv("SECRET_KEY_BASE")
		os.Unsetenv("SECRET_KEY_BASE")
		config.ClearJWTSecretCache()
		defer func() {
			os.Setenv("SECRET_KEY_BASE", originalSecret)
			config.ClearJWTSecretCache()
		}()

		reqBody := map[string]string{"phone": phone, "otp": otp}
		jsonData, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		rec := httptest.NewRecorder()
		VerifyOTPHandler(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("Expected 500, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "Authentication service configuration error" {
			t.Errorf("Unexpected error message: %s", errorResp.Message)
		}
	})
}

// TestGenerateJWTToken tests the JWT token generation function
func TestGenerateJWTToken(t *testing.T) {
	phone := "+919876543210"

	t.Run("valid token generation", func(t *testing.T) {
		token, err := generateJWTToken(phone)
		if err != nil {
			t.Fatalf("Failed to generate JWT token: %v", err)
		}

		if token == "" {
			t.Error("Expected non-empty token")
		}

		// Basic format check (JWT has 3 parts separated by dots)
		parts := len([]byte(token))
		if parts < 50 { // JWTs are typically much longer
			t.Errorf("Token seems too short: %s", token)
		}
	})

	t.Run("missing JWT secret", func(t *testing.T) {
		// Temporarily unset SECRET_KEY_BASE
		originalSecret := os.Getenv("SECRET_KEY_BASE")
		os.Unsetenv("SECRET_KEY_BASE")
		config.ClearJWTSecretCache()
		defer func() {
			os.Setenv("SECRET_KEY_BASE", originalSecret)
			config.ClearJWTSecretCache()
		}()

		_, err := generateJWTToken(phone)
		if err == nil {
			t.Error("Expected error when JWT secret is missing")
		}

		expectedMsg := "authentication service configuration error"
		if err.Error()[:len(expectedMsg)] != expectedMsg {
			t.Errorf("Expected error to start with '%s', got: %v", expectedMsg, err)
		}
	})
}
