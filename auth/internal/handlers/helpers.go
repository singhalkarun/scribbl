package handlers

import (
	"context"
	"database/sql"
	"log"
	"net/http"

	"auth/internal/middleware"
	"auth/internal/models"
	"auth/internal/utils"
)

// getUserFromContext retrieves the authenticated user from the request context
// This helper eliminates the repeated pattern of "get phone from context -> get user from DB"
func getUserFromContext(ctx context.Context, w http.ResponseWriter) (*models.User, bool) {
	phone, ok := middleware.GetUserPhoneFromContext(ctx)
	if !ok {
		utils.SendJSONError(w, "User not found in context", http.StatusUnauthorized)
		return nil, false
	}

	user, err := models.GetUserByPhone(phone)
	if err != nil {
		if err == sql.ErrNoRows {
			utils.SendJSONError(w, "User not found", http.StatusNotFound)
			return nil, false
		}
		log.Printf("Failed to get user by phone %s: %v", phone, err)
		utils.SendJSONError(w, "Failed to retrieve user information", http.StatusInternalServerError)
		return nil, false
	}

	return user, true
}
