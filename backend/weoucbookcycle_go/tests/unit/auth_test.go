package unit

import (
	"testing"
	"time"
	"os"
	"weoucbookcycle_go/config"
	"golang.org/x/crypto/bcrypt"
	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateTokenAndValidate(t *testing.T) {
	// Setup environment for config
	os.Setenv("JWT_SECRET", "test_secret_key")
	
	// Re-initialize service to pick up env var
	jwtService := config.NewJWTService()
	
	userID := "user123"
	username := "testuser"
	email := "test@example.com"
	roles := []string{"user", "admin"}
	
	// Test GenerateToken
	token, err := jwtService.GenerateToken(userID, username, email, roles)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	
	if token == "" {
		t.Fatal("Generated token is empty")
	}
	
	// Test ValidateToken
	claims, err := jwtService.ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}
	
	if claims.UserID != userID {
		t.Errorf("UserID mismatch: got %v, want %v", claims.UserID, userID)
	}
	if claims.Username != username {
		t.Errorf("Username mismatch: got %v, want %v", claims.Username, username)
	}
	if claims.Email != email {
		t.Errorf("Email mismatch: got %v, want %v", claims.Email, email)
	}
	
	// Verify expiration
	if claims.ExpiresAt.Time.Before(time.Now()) {
		t.Error("Token is expired")
	}
}

func TestInvalidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test_secret_key")
	jwtService := config.NewJWTService()
	
	// Test malformed token
	_, err := jwtService.ValidateToken("invalid.token.string")
	if err == nil {
		t.Error("Expected error for invalid token, got nil")
	}
	
	// Test empty token
	_, err = jwtService.ValidateToken("")
	if err == nil {
		t.Error("Expected error for empty token, got nil")
	}
	
	// Test token signed with different secret
	claims := &config.Claims{
		UserID: "user123",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedString, _ := token.SignedString([]byte("wrong_secret"))
	
	_, err = jwtService.ValidateToken(signedString)
	if err == nil {
		t.Error("Expected error for token signed with wrong secret, got nil")
	}
}

func TestPasswordHashing(t *testing.T) {
	password := "SecretPass123!"
	
	// Test Hash (using direct bcrypt as wrapper might not exist in utils)
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	
	if len(hashed) == 0 {
		t.Fatal("Hashed password is empty")
	}
	
	if string(hashed) == password {
		t.Fatal("Password was not hashed")
	}
	
	// Test Check
	err = bcrypt.CompareHashAndPassword(hashed, []byte(password))
	if err != nil {
		t.Errorf("CheckPasswordHash failed for correct password: %v", err)
	}
	
	err = bcrypt.CompareHashAndPassword(hashed, []byte("WrongPass"))
	if err == nil {
		t.Error("CheckPasswordHash succeeded for wrong password")
	}
}
