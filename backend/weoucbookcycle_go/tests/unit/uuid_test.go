package unit

import (
	"testing"
	"weoucbookcycle_go/utils"
)

func TestGenerateUUID(t *testing.T) {
	uuid1 := utils.GenerateUUID()
	if uuid1 == "" {
		t.Error("GenerateUUID returned empty string")
	}
	
	if len(uuid1) != 36 {
		t.Errorf("UUID length wrong: got %d, want 36", len(uuid1))
	}
	
	uuid2 := utils.GenerateUUID()
	if uuid1 == uuid2 {
		t.Error("GenerateUUID returned duplicate UUIDs")
	}
}

func TestConcurrentUUIDGeneration(t *testing.T) {
	// Test concurrency safety
	ch := make(chan string, 100)
	for i := 0; i < 100; i++ {
		go func() {
			ch <- utils.GenerateUUID()
		}()
	}
	
	uuids := make(map[string]bool)
	for i := 0; i < 100; i++ {
		uuid := <-ch
		if uuids[uuid] {
			t.Errorf("Duplicate UUID generated concurrently: %s", uuid)
		}
		uuids[uuid] = true
	}
}
