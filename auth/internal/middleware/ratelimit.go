package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"auth/internal/storage"
)

func RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			next.ServeHTTP(w, r)
			return
		}
		var phone string
		if strings.Contains(r.URL.Path, "/auth/request-otp") {
			type req struct {
				Phone string `json:"phone"`
			}
			var body req
			if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
				phone = body.Phone
			}
			if phone != "" {
				jsonBody := fmt.Sprintf(`{"phone":"%s"}`, phone)
				r.Body = io.NopCloser(strings.NewReader(jsonBody))
			}
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
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"message":"Rate limit exceeded. Try again later."}`))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
