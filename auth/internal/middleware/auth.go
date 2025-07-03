package middleware

import (
	"context"
	"net/http"
	"strings"

	"auth/internal/config"
	"auth/internal/utils"
	"github.com/golang-jwt/jwt/v4"
)

type Claims struct {
	Phone string `json:"phone"`
	jwt.RegisteredClaims
}

type contextKey string

const UserPhoneKey contextKey = "userPhone"

// AuthMiddleware validates JWT token and adds user phone to context
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			utils.SendJSONError(w, "Authorization header is required", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			utils.SendJSONError(w, "Bearer token is required", http.StatusUnauthorized)
			return
		}

		token, err := parseJWTToken(tokenString)
		if err != nil {
			utils.SendJSONError(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		if claims, ok := token.Claims.(*Claims); ok && token.Valid {
			ctx := context.WithValue(r.Context(), UserPhoneKey, claims.Phone)
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			utils.SendJSONError(w, "Invalid token claims", http.StatusUnauthorized)
		}
	})
}

// parseJWTToken parses and validates a JWT token
func parseJWTToken(tokenString string) (*jwt.Token, error) {
	jwtSecret := config.GetJWTSecret()
	return jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})
}

// GetUserPhoneFromContext extracts user phone from request context
func GetUserPhoneFromContext(ctx context.Context) (string, bool) {
	phone, ok := ctx.Value(UserPhoneKey).(string)
	return phone, ok
}
