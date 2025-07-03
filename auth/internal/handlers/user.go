package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"auth/internal/middleware"
	"auth/internal/services"
	"auth/internal/utils"
)

// UpdateUserRequest represents a request to update user information
type UpdateUserRequest struct {
	Name string `json:"name"`
}

// UserHandlers handles user operations using service layer
type UserHandlers struct {
	userService services.UserService
}

// NewUserHandlers creates new user handlers with service dependencies
func NewUserHandlers(userService services.UserService) *UserHandlers {
	return &UserHandlers{
		userService: userService,
	}
}

// GetUserHandler returns the current user information using services
func (h *UserHandlers) GetUserHandler(w http.ResponseWriter, r *http.Request) {
	phone, ok := middleware.GetUserPhoneFromContext(r.Context())
	if !ok {
		utils.SendJSONError(w, "User not found in context", http.StatusUnauthorized)
		return
	}

	// Use service layer to get user profile
	user, err := h.userService.GetUserProfile(phone)
	if err != nil {
		log.Printf("Failed to get user profile for phone %s: %v", phone, err)

		// Determine appropriate error response based on error message
		if isValidationError(err) {
			utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		} else if isUserNotFoundError(err) {
			utils.SendJSONError(w, "User not found", http.StatusNotFound)
		} else {
			utils.SendJSONError(w, "Failed to retrieve user information", http.StatusInternalServerError)
		}
		return
	}

	utils.SendJSONResponse(w, user)
}

// UpdateUserHandler allows users to update their name using services
func (h *UserHandlers) UpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	phone, ok := middleware.GetUserPhoneFromContext(r.Context())
	if !ok {
		utils.SendJSONError(w, "User not found in context", http.StatusUnauthorized)
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid JSON in update user request: %v", err)
		utils.SendJSONError(w, "Invalid JSON format in request body", http.StatusBadRequest)
		return
	}

	// Use service layer to update user profile
	user, err := h.userService.UpdateUserProfile(phone, req.Name)
	if err != nil {
		log.Printf("Failed to update user profile for phone %s: %v", phone, err)

		// Determine appropriate error response based on error message
		if isValidationError(err) {
			utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		} else if isUserNotFoundError(err) {
			utils.SendJSONError(w, "User not found", http.StatusNotFound)
		} else {
			utils.SendJSONError(w, "Failed to update user profile", http.StatusInternalServerError)
		}
		return
	}

	response := map[string]interface{}{
		"message": "User profile updated successfully",
		"user":    user,
	}
	utils.SendJSONResponse(w, response)
}

// GetUserHandlerFunc returns a standard http.HandlerFunc
func (h *UserHandlers) GetUserHandlerFunc() http.HandlerFunc {
	return h.GetUserHandler
}

// UpdateUserHandlerFunc returns a standard http.HandlerFunc
func (h *UserHandlers) UpdateUserHandlerFunc() http.HandlerFunc {
	return h.UpdateUserHandler
}

// Additional helper functions for user-specific error classification

// isUserNotFoundError checks if an error indicates a user was not found
func isUserNotFoundError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := err.Error()
	// Check for user not found error patterns
	notFoundPatterns := []string{
		"user not found",
		"no user found",
		"user does not exist",
		"no rows",
		"not found",
	}

	for _, pattern := range notFoundPatterns {
		if contains(errMsg, pattern) {
			return true
		}
	}

	return false
}
