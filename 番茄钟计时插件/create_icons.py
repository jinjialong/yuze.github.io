from PIL import Image, ImageDraw

def create_tomato_icon(size):
    """创建番茄图标"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = size // 2
    radius = int(size * 0.35)

    # 番茄主体 - 红色圆形
    tomato_color = (255, 99, 71)  # Tomato red
    draw.ellipse([center - radius, center + int(size * 0.05) - radius,
                  center + radius, center + int(size * 0.05) + radius],
                 fill=tomato_color)

    # 番茄高光
    highlight_color = (255, 180, 160, 150)
    highlight_radius = int(radius * 0.25)
    draw.ellipse([center - radius // 2 - highlight_radius,
                  center + int(size * 0.05) - radius // 2 - highlight_radius,
                  center - radius // 2 + highlight_radius,
                  center + int(size * 0.05) - radius // 2 + highlight_radius],
                 fill=highlight_color)

    # 叶子/蒂 - 绿色
    stem_color = (34, 139, 34)  # Forest green
    # 绘制简单的星形叶子
    leaf_points = [
        (center, center - radius + int(size * 0.05)),  # bottom center
        (center - int(size * 0.12), center - radius - int(size * 0.15) + int(size * 0.05)),  # left top
        (center - int(size * 0.05), center - radius + int(size * 0.05)),  # left bottom
        (center, center - radius - int(size * 0.2) + int(size * 0.05)),  # top
        (center + int(size * 0.05), center - radius + int(size * 0.05)),  # right bottom
        (center + int(size * 0.12), center - radius - int(size * 0.15) + int(size * 0.05)),  # right top
    ]
    draw.polygon(leaf_points, fill=stem_color)

    # 茎
    stem_width = max(1, int(size * 0.04))
    draw.line([center, center - radius + int(size * 0.05),
               center, center - radius - int(size * 0.25) + int(size * 0.05)],
              fill=stem_color, width=stem_width)

    return img

# 创建不同尺寸的图标
sizes = [16, 48, 128]
for size in sizes:
    icon = create_tomato_icon(size)
    icon.save(f'icon{size}.png')
    print(f'Created icon{size}.png')

print('All icons created successfully!')
