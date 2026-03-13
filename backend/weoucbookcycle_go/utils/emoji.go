package utils

import "strings"

// EmojiPack 表情包定义
type EmojiPack struct {
	Name  string
	Items []EmojiItem
}

// EmojiItem 单个表情
type EmojiItem struct {
	Code        string `json:"code"`        // 表情代码 :smile: / 笑脸
	Unicode     string `json:"unicode"`     // Unicode 代码
	Description string `json:"description"` // 描述
	Category    string `json:"category"`    // 分类
}

// 预定义的表情包
var DefaultEmojis = []EmojiItem{
	// 常用脸部表情
	{Code: ":grinning:", Unicode: "😀", Description: "露齿笑", Category: "faces"},
	{Code: ":smiley:", Unicode: "😃", Description: "笑脸露齿", Category: "faces"},
	{Code: ":smile:", Unicode: "😄", Description: "大笑", Category: "faces"},
	{Code: ":grin:", Unicode: "😁", Description: "咧嘴笑", Category: "faces"},
	{Code: ":laughing:", Unicode: "😆", Description: "大笑", Category: "faces"},
	{Code: ":sweat_smile:", Unicode: "😅", Description: "汗颜", Category: "faces"},
	{Code: ":rolling_on_the_floor_laughing:", Unicode: "🤣", Description: "笑翻", Category: "faces"},
	{Code: ":joy:", Unicode: "😂", Description: "喜极而泣", Category: "faces"},
	{Code: ":slightly_smiling_face:", Unicode: "🙂", Description: "微笑", Category: "faces"},
	{Code: ":upside_down_face:", Unicode: "🙃", Description: "倒置脸", Category: "faces"},
	{Code: ":wink:", Unicode: "😉", Description: "眨眼", Category: "faces"},
	{Code: ":blush:", Unicode: "😊", Description: "害羞", Category: "faces"},
	{Code: ":innocent:", Unicode: "😇", Description: "天使", Category: "faces"},
	{Code: ":heart_eyes:", Unicode: "😍", Description: "爱心眼", Category: "faces"},
	{Code: ":kissing_heart:", Unicode: "😘", Description: "飞吻", Category: "faces"},
	{Code: ":kissing:", Unicode: "😗", Description: "亲吻", Category: "faces"},
	{Code: ":kissing_smiling_eyes:", Unicode: "😙", Description: "含笑亲吻", Category: "faces"},
	{Code: ":kissing_closed_eyes:", Unicode: "😚", Description: "闭眼亲吻", Category: "faces"},
	{Code: ":stuck_out_tongue_winking_eye:", Unicode: "😜", Description: "吐舌眨眼", Category: "faces"},
	{Code: ":stuck_out_tongue_closed_eyes:", Unicode: "😝", Description: "闭眼吐舌", Category: "faces"},
	{Code: ":stuck_out_tongue:", Unicode: "😛", Description: "吐舌", Category: "faces"},
	{Code: ":money_mouth_face:", Unicode: "🤑", Description: "钱眼", Category: "faces"},
	{Code: ":nerd_face:", Unicode: "🤓", Description: "书呆子", Category: "faces"},
	{Code: ":sunglasses:", Unicode: "😎", Description: "墨镜", Category: "faces"},
	{Code: ":hugging_face:", Unicode: "🤗", Description: "拥抱", Category: "faces"},
	{Code: ":thinking:", Unicode: "🤔", Description: "思考", Category: "faces"},
	{Code: ":zipper_mouth_face:", Unicode: "🤐", Description: "闭嘴", Category: "faces"},
	{Code: ":raised_eyebrow:", Unicode: "🤨", Description: "挑眉", Category: "faces"},
	{Code: ":neutral_face:", Unicode: "😐", Description: "面无表情", Category: "faces"},
	{Code: ":expressionless:", Unicode: "😑", Description: "无表情", Category: "faces"},
	{Code: ":no_mouth:", Unicode: "😶", Description: "无口", Category: "faces"},
	{Code: ":smirk:", Unicode: "😏", Description: "得意", Category: "faces"},
	{Code: ":unamused:", Unicode: "😒", Description: "无奈", Category: "faces"},
	{Code: ":roll_eyes:", Unicode: "🙄", Description: "翻白眼", Category: "faces"},
	{Code: ":grimacing:", Unicode: "😬", Description: "尴尬", Category: "faces"},
	{Code: ":lying_face:", Unicode: "🤥", Description: "说谎", Category: "faces"},
	{Code: ":relieved:", Unicode: "😌", Description: "松一口气", Category: "faces"},
	{Code: ":pensive:", Unicode: "😔", Description: "沉思", Category: "faces"},
	{Code: ":sleepy:", Unicode: "😪", Description: "困倦", Category: "faces"},
	{Code: ":sleeping:", Unicode: "😴", Description: "睡着", Category: "faces"},
	{Code: ":drooling_face:", Unicode: "🤤", Description: "流口水", Category: "faces"},
	{Code: ":mask:", Unicode: "😷", Description: "口罩", Category: "faces"},
	{Code: ":face_with_thermometer:", Unicode: "🤒", Description: "发烧", Category: "faces"},
	{Code: ":face_with_head_bandage:", Unicode: "🤕", Description: "受伤", Category: "faces"},
	{Code: ":nauseated_face:", Unicode: "🤢", Description: "恶心", Category: "faces"},
	{Code: ":vomiting_face:", Unicode: "🤮", Description: "呕吐", Category: "faces"},
	{Code: ":sneezing_face:", Unicode: "🤧", Description: "打喷嚏", Category: "faces"},
	{Code: ":hot_face:", Unicode: "🥵", Description: "热", Category: "faces"},
	{Code: ":cold_face:", Unicode: "🥶", Description: "冷", Category: "faces"},
	{Code: ":woozy_face:", Unicode: "🥴", Description: "头晕", Category: "faces"},
	{Code: ":dizzy_face:", Unicode: "😵", Description: "晕", Category: "faces"},
	{Code: ":exploding_head:", Unicode: "🤯", Description: "爆炸头", Category: "faces"},
	{Code: ":zany_face:", Unicode: "🤪", Description: "疯狂", Category: "faces"},
	{Code: ":star_struck:", Unicode: "🤩", Description: "星星眼", Category: "faces"},
	{Code: ":partying_face:", Unicode: "🥳", Description: "派对", Category: "faces"},

	// 其他分类示例
	{Code: ":heart:", Unicode: "❤️", Description: "心形", Category: "symbols"},
	{Code: ":sparkling_heart:", Unicode: "💖", Description: "闪烁的心", Category: "symbols"},
	{Code: ":fire:", Unicode: "🔥", Description: "火焰", Category: "nature"},
	{Code: ":thumbsup:", Unicode: "👍", Description: "赞", Category: "people"},
	{Code: ":tada:", Unicode: "🎉", Description: "庆祝", Category: "celebration"},
	{Code: ":rocket:", Unicode: "🚀", Description: "火箭", Category: "objects"},
	{Code: ":computer:", Unicode: "💻", Description: "电脑", Category: "objects"},
}

// GetEmojisByCategory 按分类获取表情
func GetEmojisByCategory(category string) []EmojiItem {
	var result []EmojiItem
	for _, emoji := range DefaultEmojis {
		if emoji.Category == category {
			result = append(result, emoji)
		}
	}
	return result
}

// GetAllCategories 获取所有分类
func GetAllCategories() []string {
	categories := make(map[string]bool)
	for _, emoji := range DefaultEmojis {
		categories[emoji.Category] = true
	}
	result := make([]string, 0, len(categories))
	order := []string{"faces", "people", "symbols", "nature", "food", "objects", "places", "celebration"}
	for _, cat := range order {
		if categories[cat] {
			result = append(result, cat)
		}
	}
	return result
}

// ConvertEmojiCodesToUnicode 将表情代码转换为Unicode
func ConvertEmojiCodesToUnicode(text string) string {
	result := text
	for _, emoji := range DefaultEmojis {
		result = strings.ReplaceAll(result, emoji.Code, emoji.Unicode)
	}
	return result
}

// ConvertUnicodeToEmojiCodes 将Unicode转换为表情代码
func ConvertUnicodeToEmojiCodes(text string) string {
	result := text
	for _, emoji := range DefaultEmojis {
		result = strings.ReplaceAll(result, emoji.Unicode, emoji.Code)
	}
	return result
}
