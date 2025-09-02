# 图片资源组织说明

## 📁 目录结构

```
frontend/src/assets/images/
├── poker-hands/                    # 🃏 牌力相关图片
│   ├── hand-rankings-chart.png    # 牌力对比图 (PNG格式)
│   ├── hand-rankings-visual.svg   # 牌力对比图 (SVG格式)
│   └── individual-hands/          # 单个牌型图片 (未来扩展)
├── game-ui/                       # 🎮 游戏界面图片
│   ├── cards/                     # 扑克牌图片
│   ├── chips/                     # 筹码图片  
│   └── table/                     # 牌桌背景等
├── icons/                         # 🎯 图标文件
└── README.md                      # 本说明文件
```

## 📝 文件命名规范

### 牌力相关图片
- `hand-rankings-chart.png` - 牌力对比图表 (PNG格式)
- `hand-rankings-visual.svg` - 牌力对比图表 (SVG格式) 
- `hand-rankings-simple.jpg` - 简化版牌力图

### 游戏UI图片
- `card-back.png` - 牌背图案
- `chip-{color}.png` - 筹码图片 (如: chip-red.png, chip-blue.png)
- `table-background.jpg` - 牌桌背景

### 图标文件
- `poker-icon.svg` - 扑克图标
- `chip-icon.svg` - 筹码图标

## 🔧 如何放置你的图片

### 对于 card_power.png
请将你的 `card_power.png` 重命名为 `hand-rankings-chart.png` 并放置在：
```
frontend/src/assets/images/poker-hands/hand-rankings-chart.png
```

### 在Vue组件中使用
```vue
<template>
  <div class="poker-images">
    <!-- 使用PNG版本 -->
    <img src="@/assets/images/poker-hands/hand-rankings-chart.png" 
         alt="德州扑克牌力对比图" />
    
    <!-- 使用SVG版本 -->
    <img src="@/assets/images/poker-hands/hand-rankings-visual.svg" 
         alt="德州扑克牌力对比图" />
  </div>
</template>
```

## 📊 图片格式建议

- **SVG**: 适合图标、简单图形，可无限缩放
- **PNG**: 适合复杂图片、需要透明背景
- **JPG**: 适合照片、背景图，文件较小
- **WebP**: 现代格式，更小的文件体积

## 🎯 最佳实践

1. **文件大小**: 尽量控制在 500KB 以下
2. **命名**: 使用英文、小写、连字符分隔
3. **格式**: 根据用途选择合适的格式
4. **分类**: 按功能分目录存放
5. **备注**: 在代码中添加清晰的 alt 属性

---
*图片资源更新时请同步更新相关文档*