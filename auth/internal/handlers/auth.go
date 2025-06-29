package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"auth/internal/config"
	"auth/internal/models"
	"auth/internal/utils"

	"github.com/golang-jwt/jwt/v4"
)

type RequestOTPRequest struct {
	Phone string `json:"phone"`
}

type VerifyOTPRequest struct {
	Phone string `json:"phone"`
	OTP   string `json:"otp"`
}

type AuthResponse struct {
	Message string `json:"message"`
	Token   string `json:"token,omitempty"`
}

// generateJWTToken creates a JWT token for the given phone number
func generateJWTToken(phone string) (string, error) {
	jwtSecret, err := config.GetJWTSecretWithError()
	if err != nil {
		return "", fmt.Errorf("authentication service configuration error: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"phone": phone,
		"exp":   time.Now().Add(config.DefaultJWTExpiry).Unix(),
	})

	return token.SignedString([]byte(jwtSecret))
}

func RequestOTPHandler(w http.ResponseWriter, r *http.Request) {
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

	// Validate phone format (E.164 format validation)
	if err := utils.ValidatePhoneFormat(req.Phone); err != nil {
		utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	otp := utils.GenerateOTPForPhone(req.Phone)
	expireAt := time.Now().Add(config.OTPExpiry)
	if err := utils.SendOTPWith2Factor(req.Phone, otp); err != nil {
		log.Printf("Failed to send OTP to phone %s: %v", req.Phone, err)
		utils.SendJSONError(w, "Failed to send OTP. Please try again later", http.StatusInternalServerError)
		return
	}
	if err := models.StoreOTP(req.Phone, otp, expireAt); err != nil {
		log.Printf("Failed to store OTP for phone %s: %v", req.Phone, err)
		utils.SendJSONError(w, "Failed to process OTP request. Please try again later", http.StatusInternalServerError)
		return
	}
	utils.SendJSONResponse(w, AuthResponse{Message: "OTP sent successfully"})
}

func VerifyOTPHandler(w http.ResponseWriter, r *http.Request) {
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

	// Validate phone format for verify as well
	if err := utils.ValidatePhoneFormat(req.Phone); err != nil {
		utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate OTP format
	if err := utils.ValidateOTPFormat(req.OTP); err != nil {
		utils.SendJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if !models.VerifyOTP(req.Phone, req.OTP) {
		utils.SendJSONError(w, "Invalid or expired OTP. Please request a new one", http.StatusUnauthorized)
		return
	}

	user, err := models.CreateUserIfNotExists(req.Phone)
	if err != nil {
		log.Printf("Failed to create user for phone %s: %v", req.Phone, err)
		utils.SendJSONError(w, "Failed to create user account. Please try again later", http.StatusInternalServerError)
		return
	}

	tokenString, err := generateJWTToken(req.Phone)
	if err != nil {
		log.Printf("Failed to generate JWT token: %v", err)
		// Check if it's a configuration error
		if fmt.Sprintf("%v", err) == "authentication service configuration error: required environment variable SECRET_KEY_BASE not set" {
			utils.SendJSONError(w, "Authentication service configuration error", http.StatusInternalServerError)
		} else {
			utils.SendJSONError(w, "Failed to generate authentication token", http.StatusInternalServerError)
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
