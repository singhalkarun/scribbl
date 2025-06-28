package utils

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type sendOTPResponse struct {
	Status  string `json:"Status"`
	Details string `json:"Details"`
	Message string `json:"Message"`
}

func GenerateOTP() string {
	return fmt.Sprintf("%04d", time.Now().UnixNano()%10000)
}

func GenerateOTPForPhone(phone string) string {
	// Test phone number with fixed OTP (using US country code 1)
	if phone == "+19999999999" {
		return "7415"
	}
	return GenerateOTP()
}

var SendOTPWith2Factor = func(phone, otp string) error {
	// Handle test phone number (using US country code 1)
	if phone == "+19999999999" {
		return nil
	}
	
	apiKey := os.Getenv("TWO_FACTOR_API_KEY")
	templateName := os.Getenv("OTP_TEMPLATE_NAME")
	if apiKey == "" || templateName == "" {
		err := fmt.Errorf("2factor config missing: TWO_FACTOR_API_KEY or OTP_TEMPLATE_NAME not set")
		log.Printf("OTP send failed for phone %s: %v", phone, err)
		return err
	}
	
	// Remove + prefix if present for API call (matching Elixir implementation)
	phoneForAPI := strings.TrimPrefix(phone, "+")
	
	// Use custom OTP endpoint with template name from env
	url := fmt.Sprintf("https://2factor.in/API/V1/%s/SMS/%s/%s/%s", apiKey, phoneForAPI, otp, templateName)
	
	// Make GET request (matching Elixir implementation)
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("OTP send failed for phone %s: HTTP request error: %v", phone, err)
		return err
	}
	defer resp.Body.Close()
	
	var result sendOTPResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("OTP send failed for phone %s: JSON decode error: %v", phone, err)
		return err
	}
	
	if resp.StatusCode != 200 || result.Status != "Success" {
		err := fmt.Errorf("2factor send failed: %s", result.Message)
		log.Printf("OTP send failed for phone %s: 2Factor API error - Status Code: %d, Status: %s, Message: %s, Details: %s", 
			phone, resp.StatusCode, result.Status, result.Message, result.Details)
		return err
	}
	
	return nil
}
