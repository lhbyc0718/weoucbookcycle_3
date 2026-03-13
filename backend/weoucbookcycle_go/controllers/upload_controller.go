package controllers

import (
	"net/http"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// UploadController 上传控制器
type UploadController struct{}

// NewUploadController 创建上传控制器实例
func NewUploadController() *UploadController {
	return &UploadController{}
}

// UploadFile 上传文件
// @Summary 上传文件
// @Description 上传图片或其他文件（支持单文件或多文件）
// @Tags upload
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "文件"
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/upload [post]
func (uc *UploadController) UploadFile(c *gin.Context) {
	uploader := utils.NewFileUploader()

	// 尝试解析 MultipartForm
	// 默认大小限制 32MB
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		// 如果解析失败，可能是单个文件或者其他问题，尝试 FormFile 获取单个文件
		// 但通常 ParseMultipartForm 是第一步
	}

	// 使用 UploadFiles 处理，它会自动处理 form["file"] 下的所有文件
	results, err := uploader.UploadFiles(c, "file")
	if err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to upload files: "+err.Error())
		return
	}

	if len(results) == 0 {
		utils.Error(c, utils.CodeValidationError, "No file uploaded")
		return
	}

	// 构建响应 - 确保格式标准化
	var urls []string
	for _, res := range results {
		urls = append(urls, res.OriginalURL)
	}

	// 兼容多种响应格式
	firstFile := results[0]

	// 返回标准格式 - code=20000表示成功
	c.JSON(http.StatusOK, gin.H{
		"code":    20000,
		"message": "Upload successful",
		"data": gin.H{
			"url":     firstFile.OriginalURL, // 单文件兼容
			"urls":    urls,                  // 多文件支持
			"results": results,               // 完整结果
			"name":    firstFile.FileName,
			"size":    firstFile.FileSize,
		},
	})
}
