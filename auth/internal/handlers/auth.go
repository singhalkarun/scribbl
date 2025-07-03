package handlers

import (
	"log"
	"net/http"

	"auth/internal/services"
	"auth/internal/utils"
)

// RequestOTPRequest represents a request to request an OTP
type RequestOTPRequest struct {
	Phone string `json:"phone"`
}

// VerifyOTPRequest represents a request to verify an OTP
type VerifyOTPRequest struct {
	Phone string `json:"phone"`
	OTP   string `json:"otp"`
}

// AuthResponse represents an authentication response
type AuthResponse struct {
	Message string `json:"message"`
}

// AuthHandlers handles authentication using service layer
type AuthHandlers struct {
	authService services.AuthService
	userService services.UserService
}

// NewAuthHandlers creates new auth handlers with service dependencies
func NewAuthHandlers(authService services.AuthService, userService services.UserService) *AuthHandlers {
	return &AuthHandlers{
		authService: authService,
		userService: userService,
	}
}

// RequestOTPHandler handles OTP request using services
func (h *AuthHandlers) RequestOTPHandler(w http.ResponseWriter, r *http.Request) {
	var req RequestOTPRequest
	if err := utils.DecodeJSONRequest(r, &req); err != nil {
		log.Printf("Invalid JSON in OTP request: %v", err)
		utils.SendJSONError(w, "Invalid JSON format in request body", http.StatusBadRequest)
		return
	}

	if req.Phone == "" {
		utils.SendJSONError(w, "Phone number is required", http.StatusBadRequest)
		return
	}

	// Use service layer for OTP request
	if err := h.authService.RequestOTP(req.Phone); err != nil {
		log.Printf("Failed to request OTP for phone %s: %v", req.Phone, err)

		// Determine appropriate error response based on error message
		// Validation errors typically contain specific validation messages
		if isValidationError(err) {
			utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		} else {
			utils.SendJSONError(w, "Failed to send OTP. Please try again later", http.StatusInternalServerError)
		}
		return
	}

	utils.SendJSONResponse(w, AuthResponse{Message: "OTP sent successfully"})
}

// VerifyOTPHandler handles OTP verification using services
func (h *AuthHandlers) VerifyOTPHandler(w http.ResponseWriter, r *http.Request) {
	var req VerifyOTPRequest
	if err := utils.DecodeJSONRequest(r, &req); err != nil {
		log.Printf("Invalid JSON in verify OTP request: %v", err)
		utils.SendJSONError(w, "Invalid JSON format in request body", http.StatusBadRequest)
		return
	}

	if req.Phone == "" {
		utils.SendJSONError(w, "Phone number is required", http.StatusBadRequest)
		return
	}

	if req.OTP == "" {
		utils.SendJSONError(w, "OTP is required", http.StatusBadRequest)
		return
	}

	// Use service layer for OTP verification
	user, tokenString, err := h.authService.VerifyOTP(req.Phone, req.OTP)
	if err != nil {
		log.Printf("Failed to verify OTP for phone %s: %v", req.Phone, err)

		// Determine appropriate error response based on error message
		if isValidationError(err) {
			utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		} else if isAuthenticationError(err) {
			utils.SendJSONError(w, "Invalid or expired OTP. Please request a new one", http.StatusUnauthorized)
		} else {
			utils.SendJSONError(w, "Authentication failed. Please try again later", http.StatusInternalServerError)
		}
		return
	}

	response := map[string]interface{}{
		"message": "Authentication successful",
		"token":   tokenString,
		"user":    user,
	}
	utils.SendJSONResponse(w, response)
}

// RequestOTPHandlerFunc returns a standard http.HandlerFunc
func (h *AuthHandlers) RequestOTPHandlerFunc() http.HandlerFunc {
	return h.RequestOTPHandler
}

// VerifyOTPHandlerFunc returns a standard http.HandlerFunc
func (h *AuthHandlers) VerifyOTPHandlerFunc() http.HandlerFunc {
	return h.VerifyOTPHandler
}

// Helper functions for error classification

// isValidationError checks if an error is a validation error
func isValidationError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := err.Error()
	// Check for common validation error patterns
	validationPatterns := []string{
		"validation error",
		"invalid phone",
		"invalid format",
		"phone number",
		"invalid OTP",
		"OTP format",
		"name validation",
		"required field",
	}

	for _, pattern := range validationPatterns {
		if contains(errMsg, pattern) {
			return true
		}
	}

	return false
}

// isAuthenticationError checks if an error is an authentication error
func isAuthenticationError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := err.Error()
	// Check for common authentication error patterns
	authPatterns := []string{
		"invalid OTP",
		"expired OTP",
		"OTP not found",
		"authentication failed",
		"unauthorized",
		"OTP verification failed",
	}

	for _, pattern := range authPatterns {
		if contains(errMsg, pattern) {
			return true
		}
	}

	return false
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			(len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					indexOf(s, substr) >= 0)))
}

// indexOf returns the index of the first occurrence of substr in s, or -1 if not found
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
