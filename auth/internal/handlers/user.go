package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"auth/internal/models"
	"auth/internal/utils"
)

// GetUserHandler returns the current user information
func GetUserHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := getUserFromContext(r.Context(), w)
	if !ok {
		return // Error already handled by helper
	}

	utils.SendJSONResponse(w, user)
}

// UpdateUserHandler allows users to update their name
func UpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := getUserFromContext(r.Context(), w)
	if !ok {
		return // Error already handled by helper
	}

	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid JSON in update user request: %v", err)
		utils.SendJSONError(w, "Invalid JSON format in request body", http.StatusBadRequest)
		return
	}

	// Validate and sanitize name
	req.Name = utils.SanitizeName(req.Name)
	if err := utils.ValidateName(req.Name); err != nil {
		utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Update the user's name
	err := user.UpdateName(req.Name)
	if err != nil {
		log.Printf("Failed to update user name for phone %s: %v", user.Phone, err)
		utils.SendJSONError(w, "Failed to update user name", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"message": "User name updated successfully",
		"user":    user,
	}
	utils.SendJSONResponse(w, response)
}
