package main

import (
	"log"
	"os"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"

	"github.com/joho/godotenv"
)

func main() {
	// 加载 .env 文件
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("⚠️  No .env file found in ../../.env, trying current directory")
		if err := godotenv.Load(); err != nil {
			log.Println("⚠️  No .env file found")
		}
	}

	// 强制设置为开发模式
	os.Setenv("GIN_MODE", "debug")

	// 初始化数据库
	if err := config.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	db := config.DB
	log.Println("🗑️  Dropping all tables...")

	// 禁用外键约束以避免删除顺序问题
	db.Exec("SET FOREIGN_KEY_CHECKS = 0")

	// 获取所有表名
	var tables []string
	db.Raw("SHOW TABLES").Scan(&tables)

	for _, table := range tables {
		if err := db.Migrator().DropTable(table); err != nil {
			log.Printf("❌ Failed to drop table %s: %v", table, err)
		} else {
			log.Printf("✅ Dropped table %s", table)
		}
	}

	// 恢复外键约束
	db.Exec("SET FOREIGN_KEY_CHECKS = 1")

	log.Println("🎉 Database reset successfully! All data has been cleared.")

	// 重新运行迁移
	log.Println("🔄 Re-running auto migration...")
	if err := db.AutoMigrate(
		&models.User{},
		&models.Book{},
		&models.Listing{},
		&models.Message{},
		&models.Chat{},
		&models.ChatUser{},
		&models.Transaction{},
		&models.Notification{},
		&models.Order{},
		&models.Wishlist{},
		&models.Address{},
		&models.Report{},
	); err != nil {
		log.Printf("❌ Auto migrate failed: %v", err)
	} else {
		log.Println("✅ AutoMigrate completed")
		// seed default addresses after migration
		defaults := []models.Address{
			{Province: "福建省", City: "厦门市", District: "思明区", Address: "海大北海苑四号楼", Official: true, IsActive: true},
			{Province: "福建省", City: "厦门市", District: "思明区", Address: "海大东海苑六号楼", Official: true, IsActive: true},
		}

		for _, a := range defaults {
			var cnt int64
			db.Model(&models.Address{}).Where("province = ? AND city = ? AND address LIKE ? AND official = ?", a.Province, a.City, "%"+a.Address+"%", true).Count(&cnt)
			if cnt == 0 {
				if err := db.Create(&a).Error; err != nil {
					log.Printf("Failed to seed address %s: %v", a.Address, err)
				} else {
					log.Printf("Seeded default address: %s", a.Address)
				}
			}
		}
	}
}
