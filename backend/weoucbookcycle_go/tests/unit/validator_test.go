package unit

import (
	"testing"
	"weoucbookcycle_go/utils"
)

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{"Valid password", "StrongPass1!", true},
		{"Too short", "Short1!", false},
		{"No uppercase", "weakpass1!", false},
		{"No lowercase", "WEAKPASS1!", false},
		{"No number", "WeakPass!", false},
		{"No special char", "WeakPass1", false},
	}

	validator := utils.NewValidator()
	type TestStruct struct {
		Password string `validate:"password"`
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := TestStruct{Password: tt.password}
			err := validator.Validate(obj)
			got := err == nil
			if got != tt.want {
				t.Errorf("validatePassword() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidateUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		want     bool
	}{
		{"Valid username", "valid_user1", true},
		{"Too short", "ab", false},
		{"Too long", "this_username_is_way_too_long_to_be_valid", false},
		{"Start with number", "1user", false},
		{"Start with underscore", "_user", false},
		{"Invalid char", "user@name", false},
	}

	validator := utils.NewValidator()
	type TestStruct struct {
		Username string `validate:"username"`
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := TestStruct{Username: tt.username}
			err := validator.Validate(obj)
			got := err == nil
			if got != tt.want {
				t.Errorf("validateUsername() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidateISBN(t *testing.T) {
	tests := []struct {
		name string
		isbn string
		want bool
	}{
		{"Valid ISBN-10", "0-306-40615-2", true},
		{"Valid ISBN-13", "978-0-306-40615-7", true},
		{"Valid ISBN-10 No dash", "0306406152", true},
		{"Valid ISBN-13 No dash", "9780306406157", true},
		{"Invalid Length", "123456789", false},
		{"Invalid Char", "123456789G", false},
		{"Empty allowed", "", true},
	}

	validator := utils.NewValidator()
	type TestStruct struct {
		ISBN string `validate:"isbn"`
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := TestStruct{ISBN: tt.isbn}
			err := validator.Validate(obj)
			got := err == nil
			if got != tt.want {
				t.Errorf("validateISBN() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidateEmail(t *testing.T) {
	tests := []struct {
		name  string
		email string
		want  bool
	}{
		{"Valid email", "test@example.com", true},
		{"No @", "testexample.com", false},
		{"No domain", "test@", false},
		{"No user", "@example.com", false},
		{"Empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := utils.ValidateEmail(tt.email); got != tt.want {
				t.Errorf("ValidateEmail() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSanitizeString(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"No HTML", "Hello World", "Hello World"},
		{"With HTML tags", "<p>Hello</p>", "Hello"},
		{"With Script", "<script>alert(1)</script>Hello", "Hello"},
		{"Mixed", "<b>Bold</b> and <script>bad()</script>", "Bold and "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := utils.SanitizeString(tt.input); got != tt.want {
				t.Errorf("SanitizeString() = %v, want %v", got, tt.want)
			}
		})
	}
}
