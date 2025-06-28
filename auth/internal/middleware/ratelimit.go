package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"auth/internal/storage"
)

// ErrorResponse represents a standardized error response (shared with handlers)
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
	case http.StatusTooManyRequests:
		errorType = "TOO_MANY_REQUESTS"
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

func RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			next.ServeHTTP(w, r)
			return
		}
		var phone string
		var originalBody []byte
		
		if strings.Contains(r.URL.Path, "/auth/request-otp") {
			// Read the entire body first
			var err error
			originalBody, err = io.ReadAll(r.Body)
			if err != nil {
				sendJSONError(w, "Failed to read request body", http.StatusBadRequest)
				return
			}
			r.Body.Close()
			
			// Try to parse the phone number for rate limiting
			type req struct {
				Phone string `json:"phone"`
			}
			var body req
			if json.Unmarshal(originalBody, &body) == nil {
				phone = body.Phone
			}
			
			// Always reconstruct the body for the handler to use
			r.Body = io.NopCloser(strings.NewReader(string(originalBody)))
		}
		
		if phone != "" {
			key := "rl:" + phone
			count, _ := storage.RedisClient.Incr(storage.GetContext(), key).Result()
			if count == 1 {
				storage.RedisClient.Expire(storage.GetContext(), key, time.Minute)
			}
			
			// Get rate limit from environment variable, default to 5 if not set or invalid
			rateLimitStr := os.Getenv("RATE_LIMIT_PER_MINUTE")
			rateLimit := 5 // Default value
			if rateLimitStr != "" {
				if parsedLimit, err := strconv.Atoi(rateLimitStr); err == nil && parsedLimit > 0 {
					rateLimit = parsedLimit
				}
			}
			
			if count > int64(rateLimit) {
				sendJSONError(w, "Rate limit exceeded. Please try again later", http.StatusTooManyRequests)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
