# 网页功能
创建一个网页，网页上有一个输入框，用户可以在输入框中输入内容，然后点击一个按钮，按钮会调用一个API，将 API 返回内容结构化提取，展示到网页上

用户输入框中输入的内容，点击按钮后，带入到请求参数里的 Input 参数里
网页展示 API 返回结果中，Data 变量里 Output 中的图片 URL，图片 URL 是一个 JSON 字符串，需要解析出图片 URL，把图片展示到网页上，支持点击按钮下载


# API 内容

## 请求参数

curl -X POST 'https://api.coze.cn/v1/workflow/run' \
-H "Authorization: Bearer cztei_lGa8Fo5R58P6OOrSaWH3EPuNdSCyd4vQ3E5UuI1fjymS6lDvzT9rHiYZfHmjxiYzV" \
-H "Content-Type: application/json" \
-d '{
  "workflow_id": "7627780230593364003",
  "parameters": {
    "input": "https://www.weiyong.wang"
  }
}'

## 响应参数

{"usage":{"token_count":7296,"output_count":2703,"input_count":4593},"execute_id":"7624942838611345408","detail":{"logid":"20260405003234F629BB4CA0E359923452"},"code":0,"msg":"","data":"{\"output\":\"https://tools.agent101.cn/OSS/image/20260405_69d13d88d3828.png\"}","debug_url":"https://www.coze.cn/work_flow?execute_id=7624942838611345408&space_id=7430844111554527244&workflow_id=7602013656058609707&execute_mode=2"}