package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"

	"github.com/elastic/go-elasticsearch/v8/esapi"
)

const (
	IndexBooks    = "books"
	IndexUsers    = "users"
	IndexListings = "listings"
)

type SearchService struct{}

func NewSearchService() *SearchService {
	return &SearchService{}
}

// EnsureIndices creates indices with mappings if they don't exist
func (s *SearchService) EnsureIndices() error {
	client := config.GetElasticClient()
	if client == nil {
		return fmt.Errorf("elasticsearch client not initialized")
	}

	indices := []string{IndexBooks, IndexUsers, IndexListings}
	for _, index := range indices {
		req := esapi.IndicesExistsRequest{
			Index: []string{index},
		}
		res, err := req.Do(context.Background(), client)
		if err != nil {
			return err
		}
		if res.StatusCode == 404 {
			// Create index with mapping
			mapping := s.getMapping(index)
			req := esapi.IndicesCreateRequest{
				Index: index,
				Body:  strings.NewReader(mapping),
			}
			res, err := req.Do(context.Background(), client)
			if err != nil {
				return err
			}
			if res.IsError() {
				return fmt.Errorf("error creating index %s: %s", index, res.String())
			}
			log.Printf("Created index: %s", index)
		}
		res.Body.Close()
	}
	return nil
}

func (s *SearchService) getMapping(index string) string {
	switch index {
	case IndexBooks:
		return `{
			"mappings": {
				"properties": {
					"id": { "type": "keyword" },
					"title": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
					"author": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
					"description": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
					"category": { "type": "keyword" },
					"price": { "type": "double" },
					"status": { "type": "integer" },
					"created_at": { "type": "date" },
					"suggest": { "type": "completion", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" }
				}
			}
		}`
	case IndexUsers:
		return `{
			"mappings": {
				"properties": {
					"id": { "type": "keyword" },
					"username": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
					"email": { "type": "keyword" },
					"bio": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
					"status": { "type": "integer" },
					"suggest": { "type": "completion", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" }
				}
			}
		}`
	case IndexListings:
		return `{
			"mappings": {
				"properties": {
					"id": { "type": "keyword" },
					"note": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
					"price": { "type": "double" },
					"status": { "type": "keyword" },
					"book": {
						"properties": {
							"title": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
							"author": { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" }
						}
					}
				}
			}
		}`
	default:
		return "{}"
	}
}

// IndexBook indexes a book
func (s *SearchService) IndexBook(book *models.Book) error {
	doc := map[string]interface{}{
		"id":          book.ID,
		"title":       book.Title,
		"author":      book.Author,
		"description": book.Description,
		"category":    book.Category,
		"price":       book.Price,
		"status":      book.Status,
		"created_at":  book.CreatedAt,
		"suggest": []string{
			book.Title,
			book.Author,
		},
	}
	return s.indexDocument(IndexBooks, book.ID, doc)
}

// IndexUser indexes a user
func (s *SearchService) IndexUser(user *models.User) error {
	// Avoid indexing sensitive data
	doc := map[string]interface{}{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
		"bio":      user.Bio,
		"status":   user.Status,
		"suggest": []string{
			user.Username,
		},
	}
	return s.indexDocument(IndexUsers, user.ID, doc)
}

// IndexListing indexes a listing
func (s *SearchService) IndexListing(listing *models.Listing) error {
	// Flatten structure for easier search
	doc := map[string]interface{}{
		"id":     listing.ID,
		"note":   listing.Note,
		"price":  listing.Price,
		"status": listing.Status,
		"book": map[string]interface{}{
			"title":  listing.Book.Title,
			"author": listing.Book.Author,
		},
	}
	return s.indexDocument(IndexListings, listing.ID, doc)
}

func (s *SearchService) indexDocument(index, id string, body interface{}) error {
	client := config.GetElasticClient()
	if client == nil {
		return nil // Fail silently if ES is not configured
	}

	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req := esapi.IndexRequest{
		Index:      index,
		DocumentID: id,
		Body:       bytes.NewReader(data),
		Refresh:    "true",
	}

	res, err := req.Do(context.Background(), client)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("error indexing document ID=%s to index=%s: %s", id, index, res.String())
	}
	return nil
}

// DeleteDocument deletes a document from index
func (s *SearchService) DeleteDocument(index, id string) error {
	client := config.GetElasticClient()
	if client == nil {
		return nil
	}

	req := esapi.DeleteRequest{
		Index:      index,
		DocumentID: id,
	}

	res, err := req.Do(context.Background(), client)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	return nil
}

// Search performs a multi-match search with optional filters
func (s *SearchService) Search(index, query string, from, size int, filters map[string]interface{}) (map[string]interface{}, error) {
	client := config.GetElasticClient()
	if client == nil {
		return nil, fmt.Errorf("elasticsearch client not initialized")
	}

	var buf bytes.Buffer
	
	// Build bool query
	boolQuery := map[string]interface{}{
		"must": map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":     query,
				"fields":    s.getSearchFields(index),
				"fuzziness": "AUTO",
			},
		},
	}

	// Add filters
	if len(filters) > 0 {
		filterList := []map[string]interface{}{}
		for k, v := range filters {
			if v != "" && v != nil {
				// Special handling for ranges if needed, but for now exact match on terms
				// For price range, we might need special keys like "min_price", "max_price"
				if k == "min_price" {
					filterList = append(filterList, map[string]interface{}{
						"range": map[string]interface{}{
							"price": map[string]interface{}{"gte": v},
						},
					})
				} else if k == "max_price" {
					filterList = append(filterList, map[string]interface{}{
						"range": map[string]interface{}{
							"price": map[string]interface{}{"lte": v},
						},
					})
				} else {
					filterList = append(filterList, map[string]interface{}{
						"term": map[string]interface{}{
							k: v,
						},
					})
				}
			}
		}
		boolQuery["filter"] = filterList
	}

	queryMap := map[string]interface{}{
		"from": from,
		"size": size,
		"query": map[string]interface{}{
			"bool": boolQuery,
		},
		"highlight": map[string]interface{}{
			"fields": map[string]interface{}{
				"*": map[string]interface{}{},
			},
			"pre_tags":  []string{"<em>"},
			"post_tags": []string{"</em>"},
		},
	}

	if err := json.NewEncoder(&buf).Encode(queryMap); err != nil {
		return nil, err
	}

	req := esapi.SearchRequest{
		Index: []string{index},
		Body:  &buf,
	}

	res, err := req.Do(context.Background(), client)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("search error: %s", res.String())
	}

	var result map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// Suggest performs auto-completion suggestion
func (s *SearchService) Suggest(index, prefix string, size int) ([]string, error) {
	client := config.GetElasticClient()
	if client == nil {
		return nil, fmt.Errorf("elasticsearch client not initialized")
	}

	var buf bytes.Buffer
	queryMap := map[string]interface{}{
		"suggest": map[string]interface{}{
			"text-suggest": map[string]interface{}{
				"prefix": prefix,
				"completion": map[string]interface{}{
					"field":           "suggest",
					"size":            size,
					"skip_duplicates": true,
				},
			},
		},
	}

	if err := json.NewEncoder(&buf).Encode(queryMap); err != nil {
		return nil, err
	}

	req := esapi.SearchRequest{
		Index: []string{index},
		Body:  &buf,
	}

	res, err := req.Do(context.Background(), client)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("suggest error: %s", res.String())
	}

	var result map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	suggestions := make([]string, 0)
	if suggest, ok := result["suggest"].(map[string]interface{}); ok {
		if textSuggest, ok := suggest["text-suggest"].([]interface{}); ok && len(textSuggest) > 0 {
			if options, ok := textSuggest[0].(map[string]interface{})["options"].([]interface{}); ok {
				for _, opt := range options {
					if text, ok := opt.(map[string]interface{})["text"].(string); ok {
						suggestions = append(suggestions, text)
					}
				}
			}
		}
	}

	return suggestions, nil
}

func (s *SearchService) getSearchFields(index string) []string {
	switch index {
	case IndexBooks:
		return []string{"title^3", "author^2", "description", "category"}
	case IndexUsers:
		return []string{"username^3", "email", "bio"}
	case IndexListings:
		return []string{"note", "book.title^2", "book.author"}
	default:
		return []string{"*"}
	}
}
