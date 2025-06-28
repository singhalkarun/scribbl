package storage

import (
	"context"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	RedisClient *redis.Client
	once        sync.Once
)

func InitRedis() {
	once.Do(func() {
		host := os.Getenv("REDIS_HOST")
		if host == "" {
			host = "localhost"
		}
		
		port := os.Getenv("REDIS_PORT")
		if port == "" {
			port = "6379"
		}
		
		addr := host + ":" + port
		password := os.Getenv("REDIS_PASSWORD")
		
		// Parse Redis DB (defaults to 0)
		dbStr := os.Getenv("REDIS_DB")
		if dbStr == "" {
			dbStr = "0"
		}
		db, err := strconv.Atoi(dbStr)
		if err != nil {
			log.Printf("Invalid REDIS_DB value '%s', using default 0", dbStr)
			db = 0
		}
		
		RedisClient = redis.NewClient(&redis.Options{
			Addr:         addr,
			Password:     password,
			DB:           db,
			DialTimeout:  10 * time.Second,
			ReadTimeout:  5 * time.Second,
			WriteTimeout: 5 * time.Second,
			PoolSize:     10,
			MinIdleConns: 5,
			MaxRetries:   3,
		})
		
		// Test Redis connection during startup with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		
		_, pingErr := RedisClient.Ping(ctx).Result()
		if pingErr != nil {
			log.Fatalf("Failed to connect to Redis at %s: %v", addr, pingErr)
		}
		log.Printf("Successfully connected to Redis at %s", addr)
	})
}

func GetContext() context.Context {
	return context.Background()
}
