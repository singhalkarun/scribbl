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

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// sendJSONError sends a JSON error response
func sendJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	
	var errorType string
	switch statusCode {
	case http.StatusBadRequest:
		errorType = "BAD_REQUEST"
	case http.StatusUnauthorized:
		errorType = "UNAUTHORIZED"
	case http.StatusInternalServerError:
		errorType = "INTERNAL_SERVER_ERROR"
	default:
		errorType = "ERROR"
	}
	
	response := ErrorResponse{
		Error:   errorType,
		Message: message,
		Code:    statusCode,
	}
	
	json.NewEncoder(w).Encode(response)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid JSON in OTP request: %v", err)
		sendJSONError(w, "Invalid JSON format in request body", http.StatusBadRequest)
		return
	}
	
	if req.Phone == "" {
		sendJSONError(w, "Phone number is required", http.StatusBadRequest)
		return
	}

	// Validate phone format (E.164 format validation)
	if err := validatePhoneFormat(req.Phone); err != nil {
		sendJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	otp := utils.GenerateOTPForPhone(req.Phone)
	expireAt := time.Now().Add(5 * time.Minute)
	if err := utils.SendOTPWith2Factor(req.Phone, otp); err != nil {
		log.Printf("Failed to send OTP to phone %s: %v", req.Phone, err)
		sendJSONError(w, "Failed to send OTP. Please try again later", http.StatusInternalServerError)
		return
	}
	if err := models.StoreOTP(req.Phone, otp, expireAt); err != nil {
		log.Printf("Failed to store OTP for phone %s: %v", req.Phone, err)
		sendJSONError(w, "Failed to process OTP request. Please try again later", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{Message: "OTP sent successfully"})
}

func VerifyOTPHandler(w http.ResponseWriter, r *http.Request) {
	var req VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid JSON in verify OTP request: %v", err)
		sendJSONError(w, "Invalid JSON format in request body", http.StatusBadRequest)
		return
	}
	
	if req.Phone == "" {
		sendJSONError(w, "Phone number is required", http.StatusBadRequest)
		return
	}
	
	if req.OTP == "" {
		sendJSONError(w, "OTP is required", http.StatusBadRequest)
		return
	}

	// Validate phone format for verify as well
	if err := validatePhoneFormat(req.Phone); err != nil {
		sendJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate OTP format
	if err := validateOTPFormat(req.OTP); err != nil {
		sendJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if !models.VerifyOTP(req.Phone, req.OTP) {
		sendJSONError(w, "Invalid or expired OTP. Please request a new one", http.StatusUnauthorized)
		return
	}
	if err := models.CreateUserIfNotExists(req.Phone); err != nil {
		log.Printf("Failed to create user for phone %s: %v", req.Phone, err)
		sendJSONError(w, "Failed to create user account. Please try again later", http.StatusInternalServerError)
		return
	}
	jwtSecret := os.Getenv("SECRET_KEY_BASE")
	if jwtSecret == "" {
		log.Printf("SECRET_KEY_BASE environment variable not set")
		sendJSONError(w, "Authentication service configuration error", http.StatusInternalServerError)
		return
	}
	
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"phone": req.Phone,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		log.Printf("Failed to sign JWT token: %v", err)
		sendJSONError(w, "Failed to generate authentication token", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{Message: "Authentication successful", Token: tokenString})
}
