<!--
  故障样例：2026-09-29「照片位吞并」真实故障（文档 s1790565874610554000）
  只读回归样例，供 scripts/photo-swallow-check.mjs 使用；不写真实工作区、不联网。
  哪个字是"原样复制"、哪个字是"裁剪/改写"，见同目录 README.md 的两张对照表。
  本文件用 <!-- CASE: … --> 标记分隔用例；运行时取标记之后到下一个标记之前的整段，
  标记自身的说明文字与该标记之前的内容都不参与解析。
-->

<!-- CASE: minimal
     最小可复现片段：单行照片位之后紧跟一个普通段落与一个 ::: art 块，
     全篇只有一个裸 ::: 行——它在素材块末尾。旧解析器把它当成了照片位的结束符。
     本用例没有一行取自真实产物，是为定位故障手写的最小输入。 -->
::: photo 现场照片①｜慰问讲话：宋阳老师与2026级同学们在教学楼里交流

没有讲稿，没有长篇大论，这场慰问被聊成了家常。

::: art deco as-1790588922712090500
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<circle cx="150" cy="100" r="46" fill="#8fb8a4"/>
<circle cx="120" cy="86" r="18" fill="#e8b48a"/>
<circle cx="182" cy="112" r="14" fill="#d9a35f"/>
<path d="M60 170 q90 -40 180 0" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<path d="M70 40 q30 -22 60 0 q-30 22 -60 0z" fill="#c96f4a" opacity="0.6"/>
<rect x="236" y="36" width="30" height="30" rx="6" fill="#f2c76e"/>
</svg>
:::

> [!TIP|as-1790588922712090500] 中场补给提醒
> 蛋糕的甜是暂时的，补水、防晒、睡眠才是硬通货。
<!-- CASE: real
     真实裁剪版：素材已固化（composeMarkdown 实际收到的形态），保留 3 个照片位
     与它们各自的后续段落、以及每个照片位之后的那个 ::: art 块。
     逐字/裁剪对照见 README.md；SVG 主体逐字取自真实 meta.json 的 snapshots。 -->
[[theme:校园风]]
[[palette:bg=#fafcf9;accent=#5b8c6f;heading=#3f6b50;soft=#e9f3ea;border=#d7e5d6;hl=#dfeede;orange=#7fa88b;amber=#c09a63;ink=#333333]]

## 训练过半，补给站开进教学楼

::: art inline as-1788895790787834700
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" width="360" height="240">
  <!-- 背景 - 室内窗台场景 -->
  <rect x="0" y="0" width="360" height="240" fill="#f5f0e8"/>
  
  <!-- 窗户区域 -->
  <rect x="20" y="20" width="240" height="160" rx="4" fill="#d4e8e0"/>
  <!-- 窗外操场远景 -->
  <rect x="20" y="20" width="240" height="160" fill="#c8e0d8"/>
  <!-- 操场草地 -->
  <rect x="20" y="120" width="240" height="40" fill="#a8ccb8" opacity="0.6"/>
  <!-- 远处队列轮廓 -->
  <ellipse cx="80" cy="118" rx="4" ry="10" fill="#8ab8a8" opacity="0.4"/>
  <ellipse cx="95" cy="116" rx="4" ry="11" fill="#8ab8a8" opacity="0.4"/>
  <ellipse cx="112" cy="119" rx="4" ry="9" fill="#8ab8a8" opacity="0.4"/>
  <ellipse cx="128" cy="115" rx="4" ry="12" fill="#8ab8a8" opacity="0.4"/>
  <ellipse cx="146" cy="118" rx="4" ry="10" fill="#8ab8a8" opacity="0.4"/>
  <ellipse cx="164" cy="116" rx="4" ry="11" fill="#8ab8a8" opacity="0.4"/>
  <ellipse cx="182" cy="120" rx="4" ry="9" fill="#8ab8a8" opacity="0.4"/>
  <ellipse cx="200" cy="117" rx="4" ry="10" fill="#8ab8a8" opacity="0.4"/>
  <!-- 远处树木 -->
  <ellipse cx="50" cy="95" rx="15" ry="25" fill="#9cc0ac" opacity="0.3"/>
  <ellipse cx="230" cy="90" rx="18" ry="28" fill="#9cc0ac" opacity="0.3"/>
  <!-- 窗框 -->
  <rect x="18" y="18" width="244" height="164" rx="2" fill="none" stroke="#f5f0e8" stroke-width="8"/>
  <rect x="20" y="20" width="240" height="160" rx="2" fill="none" stroke="#d8c8b0" stroke-width="3"/>
  <!-- 窗框交叉线 -->
  <line x1="140" y1="20" x2="140" y2="180" stroke="#d8c8b0" stroke-width="3"/>
  <line x1="20" y1="100" x2="260" y2="100" stroke="#d8c8b0" stroke-width="3"/>
  
  <!-- 窗台台面 -->
  <rect x="10" y="180" width="340" height="20" rx="2" fill="#e8dcc8"/>
  <rect x="10" y="180" width="340" height="4" rx="1" fill="#f0e8d8" opacity="0.7"/>
  
  <!-- 墙壁下部分 -->
  <rect x="10" y="200" width="340" height="40" fill="#f8f2e8"/>
  <rect x="10" y="198" width="340" height="4" fill="#e0d4c0" opacity="0.5"/>
  
  <!-- === 迷彩帽（左侧主体）=== -->
  <!-- 帽檐投影在窗台上 -->
  <ellipse cx="115" cy="190" rx="45" ry="6" fill="#c8b898" opacity="0.4"/>
  
  <!-- 帽檐下缘阴影 -->
  <ellipse cx="115" cy="186" rx="48" ry="7" fill="#7a8a76"/>
  
  <!-- 帽檐主体 - 两段由远到近的椭圆 -->
  <ellipse cx="155" cy="183" rx="25" ry="4" fill="#6a7a66"/>
  <ellipse cx="130" cy="182" rx="40" ry="6" fill="#7a8a76"/>
  
  <!-- 帽檐上部迷彩纹理区 -->
  <ellipse cx="135" cy="181" rx="38" ry="5.5" fill="#8a9a86"/>
  <!-- 迷彩纹理斑块 -->
  <ellipse cx="115" cy="180" rx="6" ry="2.5" fill="#6a7a66" opacity="0.6"/>
  <ellipse cx="140" cy="182" rx="5" ry="2" fill="#a8b098" opacity="0.5"/>
  <ellipse cx="155" cy="180" rx="4" ry="2" fill="#7a8a76" opacity="0.7"/>
  
  <!-- 帽顶 - 圆形主体 -->
  <ellipse cx="110" cy="170" rx="38" ry="16" fill="#8a9a86"/>
  <!-- 帽顶上半球 -->
  <path d="M72,172 Q72,138 110,132 Q148,138 148,172" fill="#8a9a86"/>
  <!-- 帽顶高光 -->
  <path d="M82,165 Q82,143 110,136 Q120,138 122,142 Q108,142 96,148 Q85,155 82,165" fill="#a8b8a0" opacity="0.5"/>
  
  <!-- 迷彩花纹 - 深色块 -->
  <path d="M85,150 Q90,144 98,146 Q94,152 88,155 Z" fill="#6a7a66" opacity="0.7"/>
  <path d="M110,142 Q115,138 122,141 Q118,147 110,148 Z" fill="#6a7a66" opacity="0.7"/>
  <path d="M125,155 Q132,150 138,155 Q132,160 125,158 Z" fill="#6a7a66" opacity="0.7"/>
  <path d="M88,163 Q94,160 97,164 Q92,168 87,166 Z" fill="#6a7a66" opacity="0.7"/>
  <path d="M115,158 Q120,155 126,158 Q121,162 116,161 Z" fill="#6a7a66" opacity="0.6"/>
  
  <!-- 迷彩花纹 - 浅色块 -->
  <path d="M95,154 Q99,150 104,153 Q100,157 95,156 Z" fill="#b8c4a8" opacity="0.5"/>
  <path d="M130,148 Q134,145 138,148 Q134,151 130,150 Z" fill="#b8c4a8" opacity="0.4"/>
  <path d="M105,165 Q109,163 113,165 Q110,168 106,167 Z" fill="#b8c4a8" opacity="0.4"/>
  
  <!-- 迷彩花纹 - 中色块 -->
  <path d="M138,138 Q143,136 146,140 Q141,144 136,142 Z" fill="#7a8a76" opacity="0.5"/>
  <path d="M80,157 Q84,155 86,158 Q83,161 80,159 Z" fill="#7a8a76" opacity="0.5"/>
  
  <!-- 帽子顶部凸起折痕 -->
  <path d="M105,132 Q108,128 115,130" fill="none" stroke="#7a8a76" stroke-width="1.2" opacity="0.5"/>
  <path d="M95,140 Q98,136 103,137" fill="none" stroke="#7a8a76" stroke-width="1" opacity="0.4"/>
  
  <!-- 帽子轮廓强调 -->
  <path d="M72,172 Q70,150 82,140 Q95,130 110,128 Q130,130 140,140 Q148,150 148,172" fill="none" stroke="#6a7a66" stroke-width="1.2" opacity="0.3"/>
  
  <!-- 帽带 -->
  <path d="M72,168 Q110,177 148,168" fill="none" stroke="#5a6a56" stroke-width="3" opacity="0.4"/>
  
  <!-- === 抹茶蛋糕盒子（右侧主体）=== -->
  <!-- 投影 -->
  <ellipse cx="265" cy="192" rx="35" ry="5" fill="#c8b898" opacity="0.4"/>
  
  <!-- 盒子底部 -->
  <rect x="235" y="175" width="55" height="14" rx="2" fill="#d8c0a8"/>
  <!-- 盒子侧面 -->
  <rect x="235" y="162" width="55" height="14" rx="1" fill="#e0c8b0"/>
  <!-- 盒盖 -->
  <rect x="232" y="156" width="61" height="8" rx="2" fill="#e8d4c0"/>
  <!-- 盒盖上半部 -->
  <path d="M232,156 Q232,146 240,143 Q260,138 276,144 Q290,148 293,154 L293,156 Z" fill="#e0ccb8"/>
  
  <!-- 包装纸细节 -->
  <rect x="236" y="165" width="53" height="1" fill="#c8b098" opacity="0.5"/>
  
  <!-- 盒子面纸纹理 -->
  <path d="M240,158 Q262,163 286,158" fill="none" stroke="#c8b098" stroke-width="0.8" opacity="0.5"/>
  
  <!-- 纸盒上的抹茶图案区域 - 圆形 -->
  <ellipse cx="262" cy="168" rx="14" ry="5" fill="#a8c4a0" opacity="0.35"/>
  <text style="display:none"></text>
  
  <!-- 抹茶蛋糕可见部分（盒子开口处露出） -->
  <rect x="238" y="150" width="50" height="8" rx="2" fill="#90b880"/>
  <!-- 蛋糕顶部抹茶粉质感 -->
  <rect x="238" y="149" width="50" height="3" fill="#7aa870" opacity="0.8"/>
  <!-- 抹茶粉撒粉颗粒 -->
  <circle cx="245" cy="150" r="0.6" fill="#5a8850" opacity="0.6"/>
  <circle cx="255" cy="151" r="0.5" fill="#5a8850" opacity="0.5"/>
  <circle cx="268" cy="149" r="0.7" fill="#5a8850" opacity="0.6"/>
  <circle cx="275" cy="151" r="0.4" fill="#5a8850" opacity="0.5"/>
  <circle cx="250" cy="152" r="0.5" fill="#5a8850" opacity="0.4"/>
  <circle cx="280" cy="150" r="0.6" fill="#5a8850" opacity="0.5"/>
  
  <!-- 蛋糕侧面绿色渐变 -->
  <rect x="238" y="152" width="50" height="6" fill="#8aac78" opacity="0.7"/>
  
  <!-- 细绳 - 从盒盖系到侧面 -->
  <path d="M238,149 Q232,156 233,163 Q234,170 238,175" fill="none" stroke="#b8a888" stroke-width="1.5"/>
  <path d="M288,149 Q294,156 293,163 Q292,170 288,175" fill="none" stroke="#b8a888" stroke-width="1.5"/>
  
  <!-- 细绳下方 -->
  <line x1="238" y1="175" x2="238" y2="180" stroke="#b8a888" stroke-width="1.2"/>
  <line x1="288" y1="175" x2="288" y2="180" stroke="#b8a888" stroke-width="1.2"/>
  
  <!-- 绳结 -->
  <ellipse cx="288" cy="176" rx="2" ry="2.5" fill="none" stroke="#b8a888" stroke-width="1.5"/>
  <path d="M287,175 Q290,173 289,177" fill="none" stroke="#b8a888" stroke-width="1"/>
  
  <!-- 绷带纸屑装饰 -->
  <circle cx="284" cy="177" r="2" fill="#d8c8b8" opacity="0.5"/>
  
  <!-- === 柔和光影细节 === -->
  <!-- 窗台上光线 -->
  <ellipse cx="170" cy="186" rx="80" ry="4" fill="#ffffff" opacity="0.08"/>
  
  <!-- 窗户光晕在墙上 -->
  <path d="M20,180 L20,200 L0,240 L0,200 Z" fill="#d4e8e0" opacity="0.08"/>
  
  <!-- 帽子和盒子之间的空气感 -->
  <circle cx="185" cy="182" r="2" fill="#ffffff" opacity="0.08"/>
  <circle cx="195" cy="180" r="1.5" fill="#ffffff" opacity="0.05"/>
  
  <!-- 窗台下部分小纹理 -->
  <line x1="15" y1="202" x2="345" y2="202" stroke="#e8dcc8" stroke-width="0.8" opacity="0.3"/>
  
  <!-- 细小点缀 - 窗台角落的灰尘草籽 -->
  <circle cx="24" cy="194" r="1" fill="#c8b898" opacity="0.3"/>
  <circle cx="335" cy="193" r="0.8" fill="#c8b898" opacity="0.25"/>
  <circle cx="338" cy="195" r="0.6" fill="#c8b898" opacity="0.2"/>
  
  <!-- 帽带上通风小孔 -->
  <circle cx="95" cy="169" r="0.8" fill="#5a6a56" opacity="0.3"/>
  <circle cx="105" cy="170" r="0.8" fill="#5a6a56" opacity="0.3"/>
  <circle cx="115" cy="170.5" r="0.8" fill="#5a6a56" opacity="0.3"/>
  
  <!-- 光线轻扫过帽子 -->
  <path d="M78,158 Q88,150 100,147" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.12"/>
  
  <!-- 盒子包装点缀线 -->
  <path d="M240,163 Q262,168 284,163" fill="none" stroke="#d0b898" stroke-width="0.6" opacity="0.4"/>
</svg>
:::

军训走到过半，同学们的状态其实很好认：口令从生涩变得利落，队列从松散变得齐整，摆臂也终于能对上排面。体能在消耗，新鲜感在消退，正是最需要“补一口”的阶段。

起初还有同学站得板板正正，几句家常聊下来，气氛就松了，大家你一言我一语，说起训练场上的事——哪个排的正步终于踩上了点，谁又被教官点名上去做示范，说着说着，自己先笑了。

::: photo 现场照片①｜慰问讲话：宋阳老师与2026级同学们在教学楼里交流，同学们身着迷彩服围站在一起，现场气氛轻松

没有讲稿，没有长篇大论，这场慰问被聊成了家常。一箱蛋糕是心意，几句关心是牵挂——训练的辛苦，学院都看在眼里。

::: art deco as-1790588922712090500 as-1788896601351150500 deco-mtt2ujno
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <!-- 主体花簇集中在右下区域 -->
  
  <!-- 背景光晕/氛围 -->
  <ellipse cx="260" cy="260" rx="85" ry="60" fill="#e8f0e0" opacity="0.35"/>
  <ellipse cx="240" cy="270" rx="55" ry="35" fill="#d8e8cf" opacity="0.3"/>
  
  <!-- 主茎秆从右下方长出 -->
  <path d="M225 290 Q200 250 185 225" stroke="#5a7a4a" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M225 290 Q210 255 195 235" stroke="#6a8a5a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  
  <!-- 左侧分枝 -->
  <path d="M210 275 Q195 268 180 275" stroke="#5a7a4a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  
  <!-- 右侧分枝 -->
  <path d="M215 255 Q230 245 245 250" stroke="#5a7a4a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  
  <!-- 左侧延伸小枝 -->
  <path d="M200 290 Q185 285 175 295" stroke="#6a8a5a" stroke-width="2" fill="none" stroke-linecap="round"/>
  
  <!-- 主四叶草 - 左上第一叶（深绿，背光部） -->
  <path d="M175 195 Q160 175 170 160 Q180 148 192 158 Q200 168 195 185 Q190 198 175 195 Z" fill="#4a6a3a"/>
  <!-- 第一叶亮面 -->
  <path d="M175 195 Q168 182 173 168 Q178 158 187 163 Q193 172 190 184 Q187 193 175 195 Z" fill="#5a7a4a" opacity="0.7"/>
  
  <!-- 主四叶草 - 顶部第二叶 -->
  <path d="M178 195 Q172 175 182 158 Q190 145 203 152 Q212 162 208 178 Q204 192 190 198 Q180 200 178 195 Z" fill="#5a7a4a"/>
  <!-- 第二叶亮面/受光 -->
  <path d="M181 195 Q176 179 184 165 Q190 155 200 160 Q206 169 203 180 Q199 190 190 195 Q185 197 181 195 Z" fill="#7a9a6a" opacity="0.6"/>
  
  <!-- 主四叶草 - 右侧第三叶 -->
  <path d="M193 192 Q205 178 222 182 Q233 188 232 202 Q228 214 214 216 Q202 215 193 205 Q188 198 193 192 Z" fill="#6a8a5a"/>
  <!-- 第三叶亮面 -->
  <path d="M194 193 Q204 183 217 186 Q226 191 225 201 Q222 209 212 211 Q203 210 196 203 Q192 198 194 193 Z" fill="#8aaa7a" opacity="0.65"/>
  <!-- 第三叶叶脉 -->
  <path d="M213 187 Q212 198 207 208" stroke="#5a7a4a" stroke-width="1.2" fill="none" opacity="0.6"/>
  
  <!-- 主四叶草 - 下方第四叶 -->
  <path d="M186 200 Q172 208 172 222 Q175 234 187 236 Q199 235 206 224 Q209 212 200 204 Q193 198 186 200 Z" fill="#4a6a3a"/>
  <!-- 第四叶受光面 -->
  <path d="M186 202 Q176 208 176 219 Q179 229 188 230 Q197 229 202 221 Q204 213 198 207 Q192 203 186 202 Z" fill="#7a9a6a" opacity="0.55"/>
  
  <!-- 主四叶草中心点/亮斑 -->
  <circle cx="193" cy="199" r="4" fill="#9aba8a" opacity="0.8"/>
  <circle cx="193" cy="199" r="2.2" fill="#c0d8b0" opacity="0.9"/>
  
  <!-- 左侧小一叶 -->
  <path d="M165 285 Q150 275 148 262 Q149 252 158 250 Q167 252 170 262 Q171 275 165 285 Z" fill="#6a8a5a"/>
  <path d="M165 285 Q155 278 153 268 Q154 260 161 258 Q167 260 169 268 Q170 275 165 285 Z" fill="#8aaa7a" opacity="0.6"/>
  
  <!-- 右侧小枝上的叶 -->
  <path d="M245 240 Q255 230 258 218 Q257 208 248 207 Q239 209 237 219 Q236 232 245 240 Z" fill="#5a7a4a"/>
  <path d="M246 238 Q253 230 255 221 Q254 213 249 212 Q243 214 242 222 Q241 232 246 238 Z" fill="#7a9a6a" opacity="0.6"/>
  
  <!-- 右下方的顶部第三叶（补充层） -->
  <path d="M235 260 Q248 252 255 243 Q260 235 255 228 Q247 222 239 228 Q233 236 233 250 Q233 257 235 260 Z" fill="#6a8a5a"/>
  <path d="M236 258 Q246 251 251 244 Q255 239 251 234 Q246 230 241 234 Q237 240 236 250 Q236 255 236 258 Z" fill="#8aaa7a" opacity="0.55"/>
  
  <!-- 左上小茎延伸出的叶 -->
  <path d="M165 255 Q155 247 155 236 Q157 226 166 226 Q175 229 175 240 Q174 250 165 255 Z" fill="#5a7a4a"/>
  <path d="M165 253 Q158 248 158 240 Q160 232 167 231 Q173 234 173 242 Q172 249 165 253 Z" fill="#8aaa7a" opacity="0.5"/>
  
  <!-- 上方小枝末端的小四叶（迷你） -->
  <path d="M205 220 Q198 212 202 205 Q207 200 213 205 Q217 211 212 218 Q210 223 205 220 Z" fill="#7a9a6a" opacity="0.7"/>
  <path d="M212 218 Q218 212 224 214 Q229 218 226 224 Q222 229 215 226 Q211 223 212 218 Z" fill="#6a8a5a" opacity="0.7"/>
  
  <!-- 垂坠小茎和微型叶（右下角） -->
  <path d="M262 272 Q268 280 270 290" stroke="#7a9a6a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M268 280 Q274 275 278 278 Q279 283 274 286 Q269 285 268 280 Z" fill="#8aaa7a" opacity="0.7"/>
  <path d="M270 290 Q276 295 281 292 Q283 287 278 285 Q273 285 270 290 Z" fill="#7a9a6a" opacity="0.65"/>
  
  <!-- 右下角小芽苞 -->
  <ellipse cx="228" cy="289" rx="4" ry="3" fill="#6a8a5a" opacity="0.8"/>
  <ellipse cx="228" cy="289" rx="2" ry="1.5" fill="#9aba8a" opacity="0.7"/>
  
  <!-- 极小散叶点缀・增加密度 -->
  <path d="M155 298 Q149 294 150 289 Q155 287 159 291 Q160 296 155 298 Z" fill="#7a9a6a" opacity="0.6"/>
  <path d="M248 296 Q243 292 245 287 Q250 286 253 290 Q253 295 248 296 Z" fill="#8aaa7a" opacity="0.5"/>
  
  <!-- 散落星点・青春气息 -->
  <circle cx="158" cy="230" r="1.5" fill="#c8d8b8" opacity="0.7"/>
  <circle cx="240" cy="225" r="1.2" fill="#c8d8b8" opacity="0.6"/>
  <circle cx="228" cy="235" r="1" fill="#b0c8a0" opacity="0.5"/>
  <circle cx="175" cy="242" r="1.3" fill="#c8d8b8" opacity="0.6"/>
  <circle cx="252" cy="255" r="1.2" fill="#c8d8b8" opacity="0.5"/>
  <circle cx="145" cy="272" r="1.4" fill="#c8d8b8" opacity="0.55"/>
  <circle cx="190" cy="295" r="1" fill="#c8d8b8" opacity="0.5"/>
  <circle cx="163" cy="300" r="1.2" fill="#c8d8b8" opacity="0.45"/>
  <circle cx="208" cy="108" r="1" fill="#c8d8b8" opacity="0.4"/>
  
  <!-- 底部地面暗影过渡 -->
  <path d="M140 295 Q180 288 220 292 Q260 296 285 290 L285 300 L140 300 Z" fill="#d8e5d0" opacity="0.45"/>
  <path d="M150 300 Q200 294 260 298 L260 300 L150 300 Z" fill="#c5d8b8" opacity="0.4"/>
  
  <!-- 主四叶草叶际间的小脉络线条 -->
  <path d="M183 185 Q178 175 180 167" stroke="#4a6a3a" stroke-width="0.8" fill="none" opacity="0.4"/>
  <path d="M200 182 Q206 173 203 165" stroke="#4a6a3a" stroke-width="0.8" fill="none" opacity="0.4"/>
  
  <!-- 左侧放大叶的叶脉 -->
  <path d="M157 264 Q155 256 159 251" stroke="#5a7a4a" stroke-width="0.7" fill="none" opacity="0.4"/>
  
  <!-- 背景散光微光 -->
  <circle cx="210" cy="245" r="18" fill="#e8f0e0" opacity="0.2"/>
  <circle cx="185" cy="225" r="15" fill="#e8f0e0" opacity="0.18"/>
  <circle cx="250" cy="270" r="20" fill="#e8f0e0" opacity="0.15"/>
</svg>
:::

> [!TIP|as-1788896601351150500] 中场补给提醒
> 蛋糕的甜是暂时的，补水、防晒、睡眠才是硬通货。身体有任何不舒服，第一时间报告教官和辅导员，不要硬扛。

## 一块抹茶蛋糕，两种味道

::: art inline as-1790620956273632300
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" width="360" height="240">
  <!-- 背景层 -->
  <circle cx="180" cy="112" r="96" fill="#EDF3E6"/>
  <g fill="#E3EDDA">
    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(24,58) rotate(22) scale(1.5)"/>
    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(322,46) rotate(198) scale(1.3)"/>
    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(46,110) rotate(-40) scale(1.1)"/>
  </g>

  <!-- 盘子投影 -->
  <ellipse cx="180" cy="204" rx="132" ry="26" fill="#DCE5D3" opacity="0.75"/>

  <!-- 盘子 -->
  <ellipse cx="180" cy="196" rx="126" ry="24" fill="#F1EDE0"/>
  <ellipse cx="180" cy="194" rx="112" ry="20" fill="#F8F5EC"/>
  <ellipse cx="180" cy="202" rx="104" ry="16" fill="#E6E1D1" opacity="0.7"/>
  <ellipse cx="180" cy="188" rx="96" ry="12" fill="#FFFFFF" opacity="0.35"/>
  <path d="M 78 186 A 104 17 0 0 1 250 177" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.8" stroke-linecap="round"/>

  <!-- 蛋糕在盘上的投影 -->
  <ellipse cx="192" cy="190" rx="94" ry="14" fill="#C3CFB6" opacity="0.6"/>

  <!-- 蛋糕：右侧面 -->
  <polygon points="234,112 258,90 258,106 234,128" fill="#C6DABC"/>
  <polygon points="234,128 258,106 258,132 234,154" fill="#93B587"/>
  <polygon points="234,154 258,132 258,144 234,166" fill="#DCE8D1"/>
  <polygon points="234,166 258,144 258,162 234,184" fill="#87A97B"/>
  <path d="M234,112 L234,184 M234,112 L258,90 L258,162 L234,184" stroke="#7E9E74" stroke-width="1.4" fill="none" opacity="0.7"/>
  <line x1="234" y1="112" x2="258" y2="90" stroke="#DCEACC" stroke-width="1.6" opacity="0.9"/>

  <!-- 蛋糕：顶面 -->
  <polygon points="106,112 234,112 258,90 130,90" fill="#C2D8B3"/>
  <polygon points="120,108 226,108 244,94 142,94" fill="#D3E5C6" opacity="0.7"/>
  <path d="M110,114 q8,-4 16,0 q8,4 16,0 q8,-4 16,0 q8,4 16,0 q8,-4 16,0 q8,4 16,0 q8,-4 16,0" stroke="#E4EFD9" stroke-width="2" fill="none" opacity="0.85" stroke-linecap="round"/>

  <!-- 蛋糕：切面（正面）分层 -->
  <rect x="106" y="112" width="128" height="16" fill="#D9E8CE"/>
  <rect x="106" y="128" width="128" height="26" fill="#A9C79D"/>
  <rect x="106" y="154" width="128" height="12" fill="#EBF2E2"/>
  <rect x="106" y="166" width="128" height="18" fill="#9BBD90"/>
  <rect x="106" y="127" width="128" height="1.8" fill="#8CB283" opacity="0.6"/>
  <rect x="106" y="153" width="128" height="1.6" fill="#C6D9BC" opacity="0.85"/>
  <rect x="106" y="165" width="128" height="1.6" fill="#8CB283" opacity="0.5"/>
  <rect x="106" y="112" width="128" height="72" rx="3" fill="none" stroke="#7E9E74" stroke-width="1.6" opacity="0.8"/>

  <!-- 切面质地：蛋糕屑孔洞 -->
  <g fill="#86AC7C" opacity="0.45">
    <ellipse cx="124" cy="136" rx="2.4" ry="1.8"/>
    <ellipse cx="152" cy="143" rx="2" ry="1.5"/>
    <ellipse cx="178" cy="134" rx="2.6" ry="1.6"/>
    <ellipse cx="206" cy="146" rx="2.1" ry="1.6"/>
    <ellipse cx="226" cy="137" rx="1.8" ry="1.4"/>
    <ellipse cx="134" cy="176" rx="2.2" ry="1.6"/>
    <ellipse cx="164" cy="180" rx="1.9" ry="1.5"/>
    <ellipse cx="198" cy="173" rx="2.4" ry="1.7"/>
    <ellipse cx="222" cy="181" rx="1.7" ry="1.3"/>
    <ellipse cx="116" cy="148" rx="1.6" ry="1.2"/>
    <ellipse cx="190" cy="160" rx="1.5" ry="1.1"/>
  </g>
  <g fill="#C4D8B9" opacity="0.7">
    <ellipse cx="144" cy="159" rx="1.8" ry="1.2"/>
    <ellipse cx="176" cy="161" rx="1.5" ry="1"/>
    <ellipse cx="212" cy="159" rx="1.7" ry="1.1"/>
    <ellipse cx="126" cy="120" rx="1.6" ry="1"/>
    <ellipse cx="196" cy="119" rx="1.8" ry="1.1"/>
  </g>

  <!-- 顶面抹茶粉颗粒 -->
  <g fill="#A9C79D" opacity="0.55">
    <circle cx="152" cy="103" r="2.2"/>
    <circle cx="180" cy="97" r="1.7"/>
    <circle cx="208" cy="105" r="2"/>
    <circle cx="232" cy="99" r="1.6"/>
    <circle cx="136" cy="99" r="1.8"/>
    <circle cx="166" cy="107" r="1.4"/>
  </g>

  <!-- 茶叶 -->
  <g>
    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(56,142) rotate(-30) scale(0.9)" fill="#A9C79D"/>
    <line x1="3" y1="0" x2="31" y2="0" transform="translate(56,142) rotate(-30) scale(0.9)" stroke="#8CB283" stroke-width="1.2" opacity="0.8"/>

    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(66,178) rotate(28) scale(0.95)" fill="#91B085"/>
    <line x1="3" y1="0" x2="31" y2="0" transform="translate(66,178) rotate(28) scale(0.95)" stroke="#6F9065" stroke-width="1.2" opacity="0.8"/>

    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(286,166) rotate(162) scale(1.1)" fill="#85A87A"/>
    <line x1="3" y1="0" x2="31" y2="0" transform="translate(286,166) rotate(162) scale(1.1)" stroke="#668C5C" stroke-width="1.2" opacity="0.8"/>

    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(300,126) rotate(200) scale(0.9)" fill="#9BB98F"/>
    <line x1="3" y1="0" x2="31" y2="0" transform="translate(300,126) rotate(200) scale(0.9)" stroke="#7E9E74" stroke-width="1.2" opacity="0.8"/>

    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(96,216) rotate(8) scale(1.05)" fill="#8FB283"/>
    <line x1="3" y1="0" x2="31" y2="0" transform="translate(96,216) rotate(8) scale(1.05)" stroke="#6E9063" stroke-width="1.2" opacity="0.8"/>

    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(246,216) rotate(-14) scale(0.95)" fill="#7E9E74"/>
    <line x1="3" y1="0" x2="31" y2="0" transform="translate(246,216) rotate(-14) scale(0.95)" stroke="#5F8156" stroke-width="1.2" opacity="0.8"/>

    <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(38,196) rotate(-20) scale(1.35)" fill="#7C9E72"/>
    <line x1="3" y1="0" x2="31" y2="0" transform="translate(38,196) rotate(-20) scale(1.35)" stroke="#5F8156" stroke-width="1.2" opacity="0.85"/>
  </g>

  <!-- 前景虚化叶片，拉开空间层次 -->
  <path d="M0 0 C8 -9 24 -9 34 0 C24 9 8 9 0 0 Z" transform="translate(292,226) rotate(-28) scale(1.7)" fill="#DCE9D1" opacity="0.55"/>

  <!-- 散落粉末 -->
  <g fill="#B7CFA9" opacity="0.5">
    <circle cx="48" cy="164" r="2.4"/>
    <circle cx="60" cy="176" r="1.7"/>
    <circle cx="312" cy="182" r="2.2"/>
    <circle cx="298" cy="196" r="1.6"/>
    <circle cx="128" cy="220" r="1.9"/>
    <circle cx="172" cy="224" r="1.5"/>
    <circle cx="222" cy="196" r="1.8"/>
  </g>
</svg>
:::

蛋糕发到手，教学楼里响起此起彼伏的“谢谢老师”。箱盖一开，清清爽爽的茶香先跑了出来——不齁、不腻，和这个还带着暑气的下午意外地搭。

::: photo 现场照片②｜发放物资：宋阳老师把一盒盒抹茶蛋糕递到同学们手中，同学们身着迷彩服有序领取，脸上带着笑

有同学拆开包装咬了一口，给出了相当精确的评价：

::: art deco as-1790588922712090500
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <g>
    <path d="M296 196 C278 188 262 176 250 158 C240 142 234 126 232 106" fill="none" stroke="#6E90A8" stroke-width="4" stroke-linecap="round"/>

    <path d="M248 156 C258 136 276 120 294 114 C288 136 272 154 254 162 C250 161 248 159 248 156 Z" fill="#B3CFE4"/>
    <path d="M294 114 C288 136 272 154 254 162 L248 156 C262 142 278 126 294 114 Z" fill="#89ACCB"/>
    <path d="M252 155 C264 141 278 127 289 118" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>

    <path d="M242 142 C226 146 212 156 208 168 C220 170 234 162 246 150 C246 146 245 143 242 142 Z" fill="#B3CFE4"/>
    <path d="M208 168 C220 170 234 162 246 150 L242 142 C230 150 218 160 208 168 Z" fill="#89ACCB"/>
    <path d="M240 144 C226 152 214 160 210 166" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>

    <path d="M232 104 C224 96 223 82 232 76 C241 82 240 96 232 104 Z" fill="#F5CBD5"/>
    <path d="M232 76 C240 96 240 96 232 104 C238 94 238 86 232 76 Z" fill="#E3A7B8"/>
    <path d="M232 104 C226 100 223 94 223 89 C228 92 231 98 232 104 Z M232 104 C238 100 241 94 241 89 C236 92 233 98 232 104 Z" fill="#7FA3C2"/>

    <path d="M246 148 C240 142 240 132 246 126 C252 132 252 142 246 148 Z" fill="#F5CBD5"/>
    <path d="M246 126 C252 132 252 142 246 148 C250 140 250 134 246 126 Z" fill="#E3A7B8"/>

    <circle cx="216" cy="124" r="3.2" fill="#F7E3B0"/>
    <circle cx="232" cy="96" r="2.3" fill="#F7E3B0"/>
    <circle cx="204" cy="106" r="1.9" fill="#F7E3B0" opacity="0.8"/>
  </g>
</svg>
:::

> [!NOTE|as-1790588922712090500] 现场原声
> “这个味道跟军训太像了——入口是苦的，回味是甜的。”

## 后半程，带着回甘上场

宋老师没有讲太多大道理，只叮嘱同学们：把最后这段路走稳，把每个动作磨到标准。队列动作看着枯燥，但把一个动作磨到标准，本身就是一种本事。

::: art inline as-1789145721283342400
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" width="100%" height="100%">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#dff0fb"/>
      <stop offset="100%" stop-color="#f7e3ee"/>
    </linearGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8f4fd"/>
      <stop offset="100%" stop-color="#cfe6f7"/>
    </linearGradient>
    <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#cddceb"/>
      <stop offset="100%" stop-color="#b7cadc"/>
    </linearGradient>
    <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e6d3c8"/>
      <stop offset="100%" stop-color="#cdb3a5"/>
    </linearGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#b7d8bd"/>
      <stop offset="100%" stop-color="#8cbf9a"/>
    </linearGradient>
    <linearGradient id="light" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="360" height="240" fill="none"/>

  <rect x="18" y="14" width="112" height="120" rx="7" fill="url(#sky)" opacity="0.95"/>
  <rect x="18" y="14" width="112" height="120" rx="7" fill="none" stroke="#c3d9e8" stroke-width="2.5"/>
  <line x1="74" y1="14" x2="74" y2="134" stroke="#c3d9e8" stroke-width="2.2"/>
  <line x1="18" y1="76" x2="130" y2="76" stroke="#c3d9e8" stroke-width="2.2"/>
  <rect x="18" y="125" width="112" height="9" fill="#d8e8f2"/>
  <path d="M230 20 L340 60 L340 74 L230 34 Z" fill="url(#light)"/>
  <path d="M200 130 L348 130 L348 148 L200 148 Z" fill="#ffffff" opacity="0.28"/>

  <path d="M0 172 Q90 160 180 168 Q270 176 360 164 L360 240 L0 240 Z" fill="url(#desk)"/>
  <path d="M0 172 Q90 160 180 168 Q270 176 360 164" fill="none" stroke="#bda392" stroke-width="2"/>
  <path d="M20 200 q60 6 120 0" fill="none" stroke="#bb9f8e" stroke-width="1.1" opacity="0.6"/>
  <path d="M150 214 q70 -6 130 2" fill="none" stroke="#bb9f8e" stroke-width="1.1" opacity="0.55"/>

  <rect x="126" y="128" width="130" height="12" rx="4" fill="#b9c9d9"/>
  <rect x="134" y="140" width="10" height="30" rx="3" fill="#aebecd"/>
  <rect x="238" y="140" width="10" height="30" rx="3" fill="#aebecd"/>
  <rect x="126" y="66" width="130" height="66" rx="6" fill="url(#lid)"/>
  <rect x="130" y="72" width="122" height="54" rx="4" fill="url(#screen)"/>
  <path d="M132 74 L196 74 L156 122 L132 122 Z" fill="#ffffff" opacity="0.35"/>
  <path d="M170 88 h34" stroke="#7fa8c9" stroke-width="3" stroke-linecap="round"/>
  <path d="M176 98 h24" stroke="#9dbdd8" stroke-width="3" stroke-linecap="round"/>
  <path d="M182 108 h30" stroke="#a9c6de" stroke-width="3" stroke-linecap="round"/>
  <path d="M144 90 l6 -6 l6 6" fill="none" stroke="#8fb6d4" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M150 84 v22" stroke="#8fb6d4" stroke-width="2.4" stroke-linecap="round"/>

  <path d="M258 52 q22 -4 30 12 q6 14 -8 20 l-2 10 l-7 -8 q-20 2 -24 -12 q-3 -14 11 -22 Z" fill="#eaf3fb"/>
  <path d="M258 52 q22 -4 30 12 q6 14 -8 20 l-2 10 l-7 -8 q-20 2 -24 -12 q-3 -14 11 -22 Z" fill="none" stroke="#b8d2e8" stroke-width="2"/>
  <path d="M266 62 h18" stroke="#9dbfda" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M264 72 h22" stroke="#b1cee2" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M236 30 q16 -2 22 9 q4 10 -6 15 l-1 7 l-6 -6 q-14 1 -17 -9 q-2 -10 8 -16 Z" fill="#fbe9f1"/>
  <path d="M236 30 q16 -2 22 9 q4 10 -6 15 l-1 7 l-6 -6 q-14 1 -17 -9 q-2 -10 8 -16 Z" fill="none" stroke="#e3bcd1" stroke-width="2"/>
  <path d="M241 41 h13" stroke="#d8a7c1" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M240 49 h15" stroke="#e0b8cd" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M292 78 q4 -12 12 -4 q8 -10 10 4 q-2 12 -11 12 q-9 0 -11 -12 Z" fill="#eef1fb" opacity="0.95"/>
  <circle cx="302" cy="88" r="2.6" fill="#c2c9e6"/>
  <circle cx="310" cy="82" r="2.6" fill="#c2c9e6"/>

  <path d="M62 190 q34 -8 66 2 q10 4 8 12 q-30 8 -66 2 q-12 -4 -8 -16 Z" fill="#fdf6f9"/>
  <path d="M62 190 q34 -8 66 2 q10 4 8 12 q-30 8 -66 2 q-12 -4 -8 -16 Z" fill="none" stroke="#ddc5d2" stroke-width="2"/>
  <path d="M74 196 h44" stroke="#e5c9d7" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M72 204 h50" stroke="#e9d3de" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M78 212 h36" stroke="#eddce4" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M128 188 q6 12 -2 22" stroke="#d9bfcd" stroke-width="2"/>
  <path d="M54 208 q-16 4 -22 14" stroke="#c9a9b9" stroke-width="2.4" fill="none"/>
  <path d="M56 214 q-10 8 -12 16" stroke="#d3b5c4" stroke-width="2.2" fill="none"/>

  <path d="M296 168 q10 -14 22 -14 q14 0 18 14 Z" fill="#d9c0cd"/>
  <path d="M290 168 h54 q4 0 4 4 v22 q0 6 -6 6 h-50 q-6 0 -6 -6 v-22 q0 -4 4 -4 Z" fill="#e4ccd8"/>
  <path d="M290 168 h54 q4 0 4 4 l-6 10 q-16 -10 -46 -2 l-8 -8 q0 -4 4 -4 Z" fill="#f0dde6"/>
  <ellipse cx="317" cy="154" rx="19" ry="9" fill="#bcd9c2"/>
  <path d="M317 150 q-10 -14 -4 -24 q8 8 6 24 Z" fill="url(#leaf)"/>
  <path d="M319 150 q12 -12 6 -26 q-10 10 -8 26 Z" fill="#a3cca9"/>
  <path d="M316 150 q-16 -6 -20 -18 q14 2 20 18 Z" fill="#93c49c"/>
  <path d="M321 152 q16 -8 18 -22 q-14 6 -18 22 Z" fill="#b0d3b6"/>
  <path d="M309 154 q-8 -18 2 -28 q6 12 -2 28 Z" fill="#c2ddc6"/>
  <path d="M317 152 q2 -30 12 -36 q2 16 -12 36 Z" fill="#9ec9a5"/>
  <path d="M313 156 q-18 -2 -26 -12 q14 -2 26 12 Z" fill="#a9d0af"/>
  <path d="M310 158 h14 l-2 16 h-10 Z" fill="#8cbf9a" opacity="0.6"/>
  <path d="M290 168 h54" stroke="#c9aabb" stroke-width="1.6"/>
  <circle cx="296" cy="180" r="2" fill="#f6e9ef"/>
  <circle cx="340" cy="180" r="2" fill="#f6e9ef"/>
</svg>
:::

这个道理放进AI学院的语境里，格外好懂：模型不会因为你希望它收敛就收敛，它只认一轮轮迭代；实验不会因为你着急就出结果，它只认一次次调试。以后进了实验室、跑起模型、debug到深夜，今天在操场上磨出来的那份耐心，一样用得上。

::: art deco mint as-1790649328811657900
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <defs>
    <linearGradient id="mintLeafA" x1="0.1" y1="0.95" x2="0.9" y2="0.1">
      <stop offset="0" stop-color="#3D7050"/>
      <stop offset="0.55" stop-color="#5C9668"/>
      <stop offset="1" stop-color="#7FBA8A"/>
    </linearGradient>
    <linearGradient id="mintLeafB" x1="0.95" y1="0.9" x2="0.1" y2="0.15">
      <stop offset="0" stop-color="#37684A"/>
      <stop offset="0.6" stop-color="#579060"/>
      <stop offset="1" stop-color="#74AF80"/>
    </linearGradient>
  </defs>

  <path d="M 250 196 Q 236 184 218 176" fill="none" stroke="#2E5540" stroke-width="7" stroke-linecap="round"/>

  <path d="M 216 174 C 204 140 236 110 290 108 C 266 130 242 160 216 174 Z" fill="url(#mintLeafA)"/>
  <path d="M 220 170 Q 248 138 286 112" fill="none" stroke="#2E5540" stroke-width="5" stroke-linecap="round"/>
  <path d="M 238 151 L 231 144 M 250 140 L 243 133 M 264 128 L 258 121" fill="none" stroke="#2E5540" stroke-width="4" stroke-linecap="round"/>
  <path d="M 238 151 L 245 158 M 250 140 L 257 147 M 264 128 L 269 134" fill="none" stroke="#2E5540" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="242" cy="131" rx="8" ry="4" fill="#A8D4AC" opacity="0.5" transform="rotate(-43 242 131)"/>

  <path d="M 216 174 C 230 152 198 112 158 124 C 164 158 196 188 216 174 Z" fill="url(#mintLeafB)"/>
  <path d="M 212 170 Q 190 148 164 128" fill="none" stroke="#2E5540" stroke-width="5" stroke-linecap="round"/>
  <path d="M 196 155 L 204 147 M 196 155 L 190 161 M 182 142 L 190 134 M 182 142 L 179 148" fill="none" stroke="#2E5540" stroke-width="4" stroke-linecap="round"/>
</svg>
:::

> [!KEY|mint] 先吃苦，才有回甘
> 队列没有捷径，代码也没有。肯在枯燥里多磨一遍的人，才等得到自己的高光时刻。

::: photo 现场照片③｜大合影：慰问接近尾声，宋阳老师与2026级同学们在教学楼里合影留念，笑容灿烂

快门按下的瞬间，定格的不只是笑脸，还有军训过半的这段日子：晒黑的脸、发酸的腿、越走越齐的队列，以及一块抹茶蛋糕留下的回甘。后半程，还有更整齐的队列、更响亮的口号在操场上等着大家。2026级的同学们，把状态调好，把动作走稳——操场见。

::: art inline as-1790620964289145200
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" width="100%" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FCF0DF"/>
      <stop offset="0.5" stop-color="#F9DFBB"/>
      <stop offset="1" stop-color="#F4C992"/>
    </linearGradient>
    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D3D9B6"/>
      <stop offset="1" stop-color="#AFBB91"/>
    </linearGradient>
    <linearGradient id="doorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF7E0"/>
      <stop offset="1" stop-color="#F5C57E"/>
    </linearGradient>
    <radialGradient id="sunGlow">
      <stop offset="0" stop-color="#FFE9B8" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#FFE9B8" stop-opacity="0"/>
    </radialGradient>
    <g id="soldier">
      <ellipse cx="0" cy="1" rx="4.2" ry="1.3" fill="#7C8A66" opacity="0.32"/>
      <ellipse cx="0" cy="-17.6" rx="2.8" ry="3" fill="#E7C6A3"/>
      <path d="M-3.2,-19.4 q3.2,-3.4 6.4,0 z" fill="#66785A"/>
      <path d="M-3.4,-15.6 L3.4,-15.6 L2.6,-5 L-2.6,-5 Z" fill="#8C9F78"/>
      <path d="M-2.8,-13.8 l2.1,0 l0,2.2 l-2.1,0 z" fill="#6E8059" opacity="0.9"/>
      <path d="M0.4,-11 l1.9,0 l0,2 l-1.9,0 z" fill="#6E8059" opacity="0.9"/>
      <path d="M-2.4,-5.4 L-0.4,-5.4 L-1.1,0.2 L-2.7,0.2 Z" fill="#66785A"/>
      <path d="M0.4,-5.4 L2.4,-5.4 L2.8,0.2 L1.2,0.2 Z" fill="#728459"/>
    </g>
  </defs>

  <path d="M4,152 L4,54 Q58,24 124,40 Q196,56 252,32 Q302,12 356,32 L356,152 Z" fill="url(#skyGrad)"/>

  <circle cx="268" cy="86" r="72" fill="url(#sunGlow)"/>
  <circle cx="268" cy="86" r="27" fill="#F7CD96" opacity="0.45"/>
  <circle cx="268" cy="86" r="20" fill="#F6C88B"/>
  <circle cx="262" cy="80" r="12" fill="#FBDFAC" opacity="0.7"/>

  <ellipse cx="86" cy="72" rx="34" ry="10" fill="#FDF7EC" opacity="0.75"/>
  <ellipse cx="108" cy="65" rx="22" ry="8" fill="#FDF7EC" opacity="0.7"/>
  <ellipse cx="204" cy="108" rx="30" ry="8" fill="#FDF7EC" opacity="0.6"/>
  <ellipse cx="224" cy="103" rx="16" ry="6" fill="#FDF7EC" opacity="0.55"/>
  <ellipse cx="318" cy="58" rx="24" ry="7" fill="#FDF7EC" opacity="0.45"/>

  <circle cx="126" cy="141" r="7" fill="#9BAE84"/>
  <circle cx="136" cy="135" r="9" fill="#93A87C"/>
  <circle cx="147" cy="141" r="7" fill="#9BAE84"/>
  <circle cx="154" cy="137" r="8" fill="#93A87C"/>
  <circle cx="306" cy="139" r="8" fill="#93A87C"/>
  <circle cx="316" cy="131" r="12" fill="#8CA176"/>
  <circle cx="328" cy="137" r="9" fill="#93A87C"/>
  <circle cx="338" cy="142" r="7" fill="#9BAE84"/>
  <rect x="314" y="140" width="4" height="12" rx="1" fill="#8B7C60"/>

  <path d="M4,152 L356,152 L356,216 Q356,230 344,230 L16,230 Q4,230 4,216 Z" fill="url(#groundGrad)"/>

  <path d="M120,192 Q182,176 356,186" stroke="#C4CDA2" stroke-width="2" fill="none" opacity="0.75"/>
  <path d="M120,208 Q182,196 356,204" stroke="#C4CDA2" stroke-width="2" fill="none" opacity="0.55"/>
  <path d="M186,220 q7,-5 14,-1" stroke="#C2CD9E" stroke-width="1.4" fill="none" opacity="0.7"/>
  <path d="M242,224 q8,-4 15,-1" stroke="#C2CD9E" stroke-width="1.4" fill="none" opacity="0.6"/>
  <path d="M288,214 q6,-5 13,-1" stroke="#C2CD9E" stroke-width="1.4" fill="none" opacity="0.6"/>

  <use href="#soldier" transform="translate(150,187) scale(0.8)"/>
  <use href="#soldier" transform="translate(168,187) scale(0.8)"/>
  <use href="#soldier" transform="translate(186,187) scale(0.8)"/>
  <use href="#soldier" transform="translate(204,187) scale(0.8)"/>
  <use href="#soldier" transform="translate(222,187) scale(0.8)"/>
  <use href="#soldier" transform="translate(240,187) scale(0.8)"/>
  <use href="#soldier" transform="translate(258,187) scale(0.8)"/>
  <use href="#soldier" transform="translate(164,201) scale(0.95)"/>
  <use href="#soldier" transform="translate(192,202) scale(0.98)"/>
  <use href="#soldier" transform="translate(220,201) scale(0.95)"/>
  <use href="#soldier" transform="translate(248,202) scale(0.98)"/>

  <rect x="4" y="34" width="88" height="194" fill="#E9DAC0"/>
  <path d="M92,34 L120,46 L120,228 L92,228 Z" fill="#D2BE9D"/>
  <rect x="2" y="28" width="92" height="8" rx="2" fill="#DCC9A8"/>
  <rect x="2" y="36" width="92" height="3" fill="#C6B08C" opacity="0.6"/>
  <line x1="4" y1="50" x2="92" y2="50" stroke="#DFCDAB" stroke-width="1.2"/>
  <line x1="4" y1="98" x2="92" y2="98" stroke="#DFCDAB" stroke-width="1.2"/>

  <rect x="28" y="64" width="22" height="26" rx="2" fill="#CFBEA0"/>
  <rect x="31" y="67" width="7" height="20" fill="#E6D8BC" opacity="0.7"/>
  <rect x="60" y="64" width="22" height="26" rx="2" fill="#CFBEA0"/>
  <rect x="63" y="67" width="7" height="20" fill="#E6D8BC" opacity="0.7"/>
  <rect x="4" y="112" width="88" height="4" rx="1" fill="#D8C5A4"/>

  <rect x="18" y="126" width="60" height="86" rx="4" fill="#DBC8A6"/>
  <rect x="24" y="132" width="48" height="80" rx="2" fill="url(#doorGrad)"/>
  <rect x="30" y="138" width="36" height="68" rx="2" fill="#FFF1CB" opacity="0.55"/>
  <rect x="20" y="128" width="4" height="82" fill="#EBDCC0" opacity="0.85"/>

  <rect x="14" y="212" width="68" height="6" rx="2" fill="#E3D3B6"/>
  <rect x="8" y="218" width="80" height="6" rx="2" fill="#D8C7A8"/>
  <rect x="2" y="224" width="92" height="6.5" rx="2" fill="#CBB999"/>

  <ellipse cx="48" cy="220" rx="54" ry="16" fill="#F9DCA5" opacity="0.35"/>
  <ellipse cx="48" cy="212" rx="34" ry="9" fill="#FBE4B6" opacity="0.4"/>

  <ellipse cx="34" cy="225" rx="18" ry="3" fill="#B9A98A" opacity="0.45"/>
  <rect x="18" y="222" width="32" height="3.5" rx="1.5" fill="#E8DCC2"/>
  <rect x="21" y="211" width="26" height="12" rx="2" fill="#A6BD86"/>
  <rect x="21" y="217" width="26" height="6" rx="2" fill="#8CA56F"/>
  <rect x="20" y="206" width="28" height="6" rx="3" fill="#C6D8A8"/>
  <ellipse cx="28" cy="205" rx="4" ry="3" fill="#F7F2E2"/>
  <ellipse cx="40" cy="205.5" rx="3.5" ry="2.6" fill="#F7F2E2"/>
  <circle cx="26" cy="215" r="1" fill="#7E985F"/>
  <circle cx="34" cy="217" r="1" fill="#7E985F"/>
  <circle cx="43" cy="214" r="1" fill="#7E985F"/>
</svg>
:::

欢迎在评论区聊聊：这一口抹茶蛋糕，你尝出了什么？
<!-- CASE: end -->
