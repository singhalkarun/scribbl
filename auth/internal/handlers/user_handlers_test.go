package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"auth/internal/middleware"
	"auth/internal/models"
	"auth/internal/utils"

	"github.com/golang-jwt/jwt/v4"
)

// Helper function to generate a test JWT token
func generateTestJWT(phone string) (string, error) {
	jwtSecret := os.Getenv("SECRET_KEY_BASE")
	if jwtSecret == "" {
		return "", fmt.Errorf("SECRET_KEY_BASE not set")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"phone": phone,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})

	return token.SignedString([]byte(jwtSecret))
}

// TestGetUserHandler tests the user profile retrieval handler
func TestGetUserHandler(t *testing.T) {
	phone := "+919876543210"

	t.Run("valid request with authenticated user", func(t *testing.T) {
		models.ClearMockUsers()

		// Create user first
		_, err := models.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}

		// Generate JWT token
		token, err := generateTestJWT(phone)
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		// Create request with authorization header
		req := httptest.NewRequest("GET", "/auth/user", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		// Apply auth middleware and call handler
		authHandler := middleware.AuthMiddleware(http.HandlerFunc(GetUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
		}

		var responseUser map[string]interface{}
		if err := json.NewDecoder(rec.Body).Decode(&responseUser); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		// Verify response structure
		if responseUser["phone"] != phone {
			t.Errorf("Expected phone %s, got %v", phone, responseUser["phone"])
		}

		requiredFields := []string{"id", "phone", "created_at", "updated_at"}
		for _, field := range requiredFields {
			if _, exists := responseUser[field]; !exists {
				t.Errorf("Missing required field: %s", field)
			}
		}

		// Name should be null for new user
		if responseUser["name"] != nil {
			t.Errorf("Expected name to be null for new user, got %v", responseUser["name"])
		}
	})

	t.Run("missing authorization header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/auth/user", nil)

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(GetUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Error != "UNAUTHORIZED" {
			t.Errorf("Expected UNAUTHORIZED error type, got %s", errorResp.Error)
		}
	})

	t.Run("invalid JWT token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/auth/user", nil)
		req.Header.Set("Authorization", "Bearer invalidtoken")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(GetUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", rec.Code)
		}
	})

	t.Run("user not found in database", func(t *testing.T) {
		models.ClearMockUsers() // Clear all users

		// Generate JWT for non-existent user
		token, err := generateTestJWT("+911234567890")
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		req := httptest.NewRequest("GET", "/auth/user", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(GetUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("Expected 404, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "User not found" {
			t.Errorf("Expected 'User not found', got %s", errorResp.Message)
		}
	})
}

// TestUpdateUserHandler tests the user name update handler
func TestUpdateUserHandler(t *testing.T) {
	phone := "+919876543210"

	t.Run("valid name update", func(t *testing.T) {
		models.ClearMockUsers()

		// Create user first
		_, err := models.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}

		// Generate JWT token
		token, err := generateTestJWT(phone)
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		updateData := map[string]string{"name": "John Doe"}
		jsonData, _ := json.Marshal(updateData)

		req := httptest.NewRequest("PUT", "/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(UpdateUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
		}

		var response map[string]interface{}
		if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["message"] != "User name updated successfully" {
			t.Errorf("Expected success message, got %v", response["message"])
		}

		user, ok := response["user"].(map[string]interface{})
		if !ok {
			t.Fatalf("Expected user object in response")
		}

		if user["name"] != "John Doe" {
			t.Errorf("Expected name 'John Doe', got %v", user["name"])
		}
	})

	t.Run("empty name validation", func(t *testing.T) {
		models.ClearMockUsers()

		// Create user first
		_, err := models.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}

		// Generate JWT token
		token, err := generateTestJWT(phone)
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		updateData := map[string]string{"name": ""}
		jsonData, _ := json.Marshal(updateData)

		req := httptest.NewRequest("PUT", "/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(UpdateUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "name cannot be empty" {
			t.Errorf("Expected 'name cannot be empty', got %s", errorResp.Message)
		}
	})

	t.Run("name too long validation", func(t *testing.T) {
		models.ClearMockUsers()

		// Create user first
		_, err := models.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}

		// Generate JWT token
		token, err := generateTestJWT(phone)
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		longName := string(make([]byte, 101)) // 101 characters
		for i := range longName {
			longName = longName[:i] + "A" + longName[i+1:]
		}

		updateData := map[string]string{"name": longName}
		jsonData, _ := json.Marshal(updateData)

		req := httptest.NewRequest("PUT", "/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(UpdateUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "name cannot be longer than 100 characters" {
			t.Errorf("Expected length validation error, got %s", errorResp.Message)
		}
	})

	t.Run("name with whitespace is trimmed", func(t *testing.T) {
		models.ClearMockUsers()

		// Create user first
		_, err := models.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}

		// Generate JWT token
		token, err := generateTestJWT(phone)
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		updateData := map[string]string{"name": "  John Doe  "}
		jsonData, _ := json.Marshal(updateData)

		req := httptest.NewRequest("PUT", "/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(UpdateUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d", rec.Code)
		}

		var response map[string]interface{}
		json.NewDecoder(rec.Body).Decode(&response)

		user, ok := response["user"].(map[string]interface{})
		if !ok {
			t.Fatalf("Expected user object in response")
		}

		if user["name"] != "John Doe" {
			t.Errorf("Expected trimmed name 'John Doe', got %v", user["name"])
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		models.ClearMockUsers()

		// Create user first
		_, err := models.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}

		// Generate JWT token
		token, err := generateTestJWT(phone)
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		req := httptest.NewRequest("PUT", "/auth/user/update", bytes.NewReader([]byte("invalid json")))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(UpdateUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "Invalid JSON format in request body" {
			t.Errorf("Expected JSON error, got %s", errorResp.Message)
		}
	})

	t.Run("missing authorization", func(t *testing.T) {
		updateData := map[string]string{"name": "John Doe"}
		jsonData, _ := json.Marshal(updateData)

		req := httptest.NewRequest("PUT", "/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(UpdateUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", rec.Code)
		}
	})

	t.Run("user not found in database", func(t *testing.T) {
		models.ClearMockUsers() // Clear all users

		// Generate JWT for non-existent user
		token, err := generateTestJWT("+911234567890")
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		updateData := map[string]string{"name": "John Doe"}
		jsonData, _ := json.Marshal(updateData)

		req := httptest.NewRequest("PUT", "/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		authHandler := middleware.AuthMiddleware(http.HandlerFunc(UpdateUserHandler))
		rec := httptest.NewRecorder()
		authHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("Expected 404, got %d", rec.Code)
		}

		var errorResp utils.ErrorResponse
		json.NewDecoder(rec.Body).Decode(&errorResp)
		if errorResp.Message != "User not found" {
			t.Errorf("Expected 'User not found', got %s", errorResp.Message)
		}
	})
}
