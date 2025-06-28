package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"time"

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

// validatePhoneFormat validates E.164 format (must start with + followed by country code and number)
func validatePhoneFormat(phone string) error {
	// E.164 format validation: + followed by country code (1-3 digits) and subscriber number
	// Minimum realistic length is 8 digits total (e.g., +1234567), maximum is 15
	matched, _ := regexp.MatchString(`^\+[1-9]\d{6,14}$`, phone)
	if !matched {
		return fmt.Errorf("Phone number must be in E.164 format (e.g., +919876543210)")
	}
	return nil
}

// validateOTPFormat validates that OTP is exactly 4 digits
func validateOTPFormat(otp string) error {
	matched, _ := regexp.MatchString(`^\d{4}$`, otp)
	if !matched {
		return fmt.Errorf("OTP must be exactly 4 digits")
	}
	return nil
}

func RequestOTPHandler(w http.ResponseWriter, r *http.Request) {
	var req RequestOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Phone == "" {
		log.Printf("Invalid OTP request: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate phone format (E.164 format validation)
	if err := validatePhoneFormat(req.Phone); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	otp := utils.GenerateOTPForPhone(req.Phone)
	expireAt := time.Now().Add(5 * time.Minute)
	if err := utils.SendOTPWith2Factor(req.Phone, otp); err != nil {
		log.Printf("Failed to send OTP to phone %s: %v", req.Phone, err)
		http.Error(w, "Failed to send OTP", http.StatusInternalServerError)
		return
	}
	if err := models.StoreOTP(req.Phone, otp, expireAt); err != nil {
		log.Printf("Failed to store OTP for phone %s: %v", req.Phone, err)
		http.Error(w, "Failed to store OTP", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{Message: "OTP sent"})
}

func VerifyOTPHandler(w http.ResponseWriter, r *http.Request) {
	var req VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Phone == "" || req.OTP == "" {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate phone format for verify as well
	if err := validatePhoneFormat(req.Phone); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate OTP format
	if err := validateOTPFormat(req.OTP); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if !models.VerifyOTP(req.Phone, req.OTP) {
		http.Error(w, "Invalid or expired OTP", http.StatusUnauthorized)
		return
	}
	if err := models.CreateUserIfNotExists(req.Phone); err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}
	jwtSecret := os.Getenv("SECRET_KEY_BASE")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"phone": req.Phone,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		http.Error(w, "Failed to sign token", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{Message: "Authenticated", Token: tokenString})
}
