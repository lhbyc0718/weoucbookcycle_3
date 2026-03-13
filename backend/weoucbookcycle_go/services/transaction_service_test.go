package services

import (
	"testing"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	// Migrate necessary models
	if err := db.AutoMigrate(&models.User{}, &models.Book{}, &models.Listing{}, &models.Transaction{}); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	return db
}

func TestTransactionLifecycle(t *testing.T) {
	db := setupTestDB(t)
	// override global DB
	config.DB = db

	// create users
	seller := models.User{Username: "seller1", Email: "seller1@example.com", Password: "pass"}
	buyer := models.User{Username: "buyer1", Email: "buyer1@example.com", Password: "pass"}
	if err := db.Create(&seller).Error; err != nil {
		t.Fatalf("create seller: %v", err)
	}
	if err := db.Create(&buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	// create book
	book := models.Book{Title: "Test Book", Price: 10.0, SellerID: seller.ID, Status: models.BookStatusAvailable}
	if err := db.Create(&book).Error; err != nil {
		t.Fatalf("create book: %v", err)
	}

	// create listing
	listing := models.Listing{BookID: book.ID, SellerID: seller.ID, Price: 10.0, Status: "available"}
	if err := db.Create(&listing).Error; err != nil {
		t.Fatalf("create listing: %v", err)
	}

	ts := NewTransactionService()

	// Create transaction
	txObj, err := ts.CreateTransaction(listing.ID, buyer.ID, "")
	if err != nil {
		t.Fatalf("create transaction failed: %v", err)
	}
	if txObj.Status != "pending" {
		t.Fatalf("expected pending, got %s", txObj.Status)
	}

	// Seller confirm
	_, err = ts.SellerConfirm(txObj.ID, seller.ID)
	if err != nil {
		t.Fatalf("seller confirm failed: %v", err)
	}

	var listingAfter models.Listing
	if err := db.First(&listingAfter, "id = ?", listing.ID).Error; err != nil {
		t.Fatalf("fetch listing: %v", err)
	}
	if listingAfter.Status != "reserved" {
		t.Fatalf("expected listing reserved, got %s", listingAfter.Status)
	}

	var bookAfter models.Book
	if err := db.First(&bookAfter, "id = ?", book.ID).Error; err != nil {
		t.Fatalf("fetch book: %v", err)
	}
	if bookAfter.Status != models.BookStatusInProgress {
		t.Fatalf("expected book in progress status, got %d", bookAfter.Status)
	}

	// Buyer confirm receipt
	_, err = ts.BuyerConfirmReceipt(txObj.ID, buyer.ID)
	if err != nil {
		t.Fatalf("buyer confirm receipt failed: %v", err)
	}

	var listingSold models.Listing
	if err := db.First(&listingSold, "id = ?", listing.ID).Error; err != nil {
		t.Fatalf("fetch listing sold: %v", err)
	}
	if listingSold.Status != "sold" {
		t.Fatalf("expected listing sold, got %s", listingSold.Status)
	}

	var bookSold models.Book
	if err := db.First(&bookSold, "id = ?", book.ID).Error; err != nil {
		t.Fatalf("fetch book sold: %v", err)
	}
	if bookSold.Status != models.BookStatusSold {
		t.Fatalf("expected book sold status, got %d", bookSold.Status)
	}

	// Now test cancel flow: new listing
	book2 := models.Book{Title: "Cancel Book", Price: 5.0, SellerID: seller.ID, Status: models.BookStatusAvailable}
	if err := db.Create(&book2).Error; err != nil {
		t.Fatalf("create book2: %v", err)
	}
	listing2 := models.Listing{BookID: book2.ID, SellerID: seller.ID, Price: 5.0, Status: "available"}
	if err := db.Create(&listing2).Error; err != nil {
		t.Fatalf("create listing2: %v", err)
	}

	tx2, err := ts.CreateTransaction(listing2.ID, buyer.ID, "")
	if err != nil {
		t.Fatalf("create tx2 failed: %v", err)
	}

	// seller confirm then cancel
	_, err = ts.SellerConfirm(tx2.ID, seller.ID)
	if err != nil {
		t.Fatalf("seller confirm tx2 failed: %v", err)
	}

	_, err = ts.CancelTransaction(tx2.ID, buyer.ID)
	if err != nil {
		t.Fatalf("cancel transaction failed: %v", err)
	}

	var listing2After models.Listing
	if err := db.First(&listing2After, "id = ?", listing2.ID).Error; err != nil {
		t.Fatalf("fetch listing2 after cancel: %v", err)
	}
	if listing2After.Status != "available" {
		t.Fatalf("expected listing2 available after cancel, got %s", listing2After.Status)
	}

	var book2After models.Book
	if err := db.First(&book2After, "id = ?", book2.ID).Error; err != nil {
		t.Fatalf("fetch book2 after cancel: %v", err)
	}
	if book2After.Status != models.BookStatusAvailable {
		t.Fatalf("expected book2 available after cancel, got %d", book2After.Status)
	}

	// sanity: completed transaction should have completed_at set
	var txCompleted models.Transaction
	if err := db.First(&txCompleted, "id = ?", txObj.ID).Error; err != nil {
		t.Fatalf("fetch txCompleted: %v", err)
	}
	if txCompleted.CompletedAt == nil {
		t.Fatalf("expected CompletedAt set, got nil")
	}
	if time.Since(*txCompleted.CompletedAt) > time.Minute { /* ok */
	}
}
