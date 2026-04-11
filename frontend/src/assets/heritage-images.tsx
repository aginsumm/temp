const HeritageImages = () => {
  const images = [
    {
      id: 1,
      name: '昆曲',
      gradient: 'linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #CD853F 100%)',
      pattern: (
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <linearGradient id="kunqu-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B4513" />
              <stop offset="50%" stopColor="#D2691E" />
              <stop offset="100%" stopColor="#CD853F" />
            </linearGradient>
            <pattern
              id="kunqu-pattern"
              x="0"
              y="0"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)" />
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#kunqu-grad)" />
          <rect width="400" height="400" fill="url(#kunqu-pattern)" opacity="0.3" />

          {/* 戏曲脸谱元素 */}
          <g transform="translate(200, 200)">
            <ellipse
              cx="0"
              cy="0"
              rx="80"
              ry="90"
              fill="none"
              stroke="rgba(255,215,0,0.4)"
              strokeWidth="3"
            />
            <path
              d="M -60,-30 Q -80,0 -60,30 M 60,-30 Q 80,0 60,30"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="4"
              fill="none"
            />
            <circle cx="-35" cy="-15" r="12" fill="rgba(220,20,60,0.7)" />
            <circle cx="35" cy="-15" r="12" fill="rgba(220,20,60,0.7)" />
            <path
              d="M -25,25 Q 0,45 25,25"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M -70,-60 L 0,-120 L 70,-60"
              stroke="rgba(218,165,32,0.6)"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M -55,-65 L 0,-105 L 55,-65"
              stroke="rgba(218,165,32,0.4)"
              strokeWidth="2"
              fill="none"
            />
          </g>

          {/* 装饰云纹 */}
          <g transform="translate(320, 80)" opacity="0.3">
            <path
              d="M0,10 Q10,0 20,10 Q30,5 40,15 Q45,12 48,18 Q42,24 34,20 Q26,27 16,19 Q8,25 0,18 Z"
              fill="rgba(218,165,32,0.5)"
              stroke="rgba(218,165,32,0.8)"
              strokeWidth="1"
            />
          </g>
        </svg>
      ),
    },
    {
      id: 2,
      name: '苏绣',
      gradient: 'linear-gradient(135deg, #C41E3A 0%, #DC143C 50%, #FF69B4 100%)',
      pattern: (
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <radialGradient id="suxiu-grad">
              <stop offset="0%" stopColor="#FF69B4" />
              <stop offset="50%" stopColor="#DC143C" />
              <stop offset="100%" stopColor="#C41E3A" />
            </radialGradient>
            <pattern
              id="suxiu-pattern"
              x="0"
              y="0"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="20"
                y2="20"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="0.5"
              />
              <line
                x1="20"
                y1="0"
                x2="0"
                y2="20"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#suxiu-grad)" />
          <rect width="400" height="400" fill="url(#suxiu-pattern)" opacity="0.4" />

          {/* 牡丹花图案 */}
          <g transform="translate(200, 210)">
            {[...Array(8)].map((_, i) => (
              <ellipse
                key={i}
                cx={Math.cos((i * Math.PI * 2) / 8) * 35}
                cy={Math.sin((i * Math.PI * 2) / 8) * 35 - 10}
                rx="28"
                ry="38"
                fill={`hsl(${340 + i * 5}, 75%, ${60 + i * 3}%)`}
                opacity="0.8"
                transform={`rotate(${i * 45})`}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
              />
            ))}
            <circle cx="0" cy="-5" r="15" fill="#FFD700" opacity="0.9" />

            {/* 花蕊 */}
            {[...Array(12)].map((_, i) => (
              <line
                key={i}
                x1="0"
                y1="-5"
                x2={Math.cos((i * Math.PI * 2) / 12) * 22}
                y2={Math.sin((i * Math.PI * 2) / 12) * 22 - 5}
                stroke="#DAA520"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}

            {/* 叶子 */}
            <path d="M -60,40 Q -80,60 -70,80 Q -50,70 -40,50 Z" fill="#228B22" opacity="0.7" />
            <path d="M 60,40 Q 80,60 70,80 Q 50,70 40,50 Z" fill="#228B22" opacity="0.7" />
          </g>

          {/* 刺绣针脚纹理 */}
          <g opacity="0.2">
            {Array.from({ length: 20 }, (_, i) => (
              <line
                key={i}
                x1={50 + (i % 5) * 70}
                y1={50 + Math.floor(i / 5) * 70}
                x2={70 + (i % 5) * 70}
                y2={70 + Math.floor(i / 5) * 70}
                stroke="white"
                strokeWidth="1"
                strokeDasharray="2,3"
              />
            ))}
          </g>
        </svg>
      ),
    },
    {
      id: 3,
      name: '蜀锦',
      gradient: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 50%, #93C5FD 100%)',
      pattern: (
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <linearGradient id="shujin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="33%" stopColor="#2563EB" />
              <stop offset="66%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
            <pattern
              id="shujin-weave"
              x="0"
              y="0"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <rect width="15" height="15" fill="rgba(59,130,246,0.3)" />
              <rect x="15" y="15" width="15" height="15" fill="rgba(147,197,253,0.3)" />
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#shujin-grad)" />
          <rect width="400" height="400" fill="url(#shujin-weave)" opacity="0.5" />

          {/* 几何纹样 */}
          <g transform="translate(200, 200)">
            <polygon
              points="0,-80 69,-40 69,40 0,80 -69,40 -69,-40"
              fill="none"
              stroke="rgba(255,215,0,0.5)"
              strokeWidth="3"
            />
            <polygon
              points="0,-60 52,-30 52,30 0,60 -52,30 -52,-30"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
            />
            <polygon
              points="0,-40 35,-20 35,20 0,40 -35,20 -35,-20"
              fill="rgba(218,165,32,0.2)"
              stroke="rgba(218,165,32,0.6)"
              strokeWidth="2"
            />

            {/* 内部装饰 */}
            <circle
              cx="0"
              cy="0"
              r="20"
              fill="rgba(255,215,0,0.3)"
              stroke="rgba(255,215,0,0.8)"
              strokeWidth="2"
            />
            <circle cx="0" cy="0" r="8" fill="#FFD700" />
          </g>

          {/* 织物纹理线条 */}
          <g opacity="0.3">
            {Array.from({ length: 15 }, (_, i) => (
              <line
                key={i}
                x1="0"
                y1={i * 28}
                x2="400"
                y2={i * 28}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.5"
              />
            ))}
          </g>
        </svg>
      ),
    },
    {
      id: 4,
      name: '银花丝',
      gradient: 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 50%, #FFD700 100%)',
      pattern: (
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <linearGradient id="silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#808080" />
              <stop offset="30%" stopColor="#C0C0C0" />
              <stop offset="70%" stopColor="#E8E8E8" />
              <stop offset="100%" stopColor="#FFD700" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="400" height="400" fill="url(#silver-grad)" />

          {/* 银丝编织纹样 */}
          <g transform="translate(200, 200)" filter="url(#glow)">
            {[...Array(12)].map((_, i) => (
              <g key={i}>
                <ellipse
                  cx="0"
                  cy="0"
                  rx={40 + i * 8}
                  ry={40 + i * 8}
                  fill="none"
                  stroke={`rgba(${192 + i * 5}, ${192 + i * 5}, ${200 + i * 4}, ${0.6 - i * 0.04})`}
                  strokeWidth="1.5"
                  transform={`rotate(${i * 15})`}
                />

                {/* 螺旋花纹 */}
                <path
                  d={`M ${Math.cos(i * 0.5) * (50 + i * 5)} ${Math.sin(i * 0.5) * (50 + i * 5)} 
                      Q ${Math.cos(i * 0.5 + 1) * (60 + i * 5)} ${Math.sin(i * 0.5 + 1) * (60 + i * 5)}
                        ${Math.cos(i * 0.5 + 2) * (50 + i * 5)} ${Math.sin(i * 0.5 + 2) * (50 + i * 5)}`}
                  stroke="rgba(255,215,0,0.4)"
                  strokeWidth="1"
                  fill="none"
                />
              </g>
            ))}

            {/* 中心宝石 */}
            <polygon
              points="0,-25 22,-12 22,12 0,25 -22,12 -22,-12"
              fill="rgba(255,215,0,0.6)"
              stroke="#FFD700"
              strokeWidth="2"
            />
            <polygon points="0,-15 13,-7 13,7 0,15 -13,7 -13,-7" fill="rgba(255,255,255,0.8)" />
          </g>

          {/* 光泽效果 */}
          <defs>
            <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.4" />
              <stop offset="50%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <rect width="400" height="400" fill="url(#shine)" opacity="0.3" />
        </svg>
      ),
    },
    {
      id: 5,
      name: '川剧',
      gradient: 'linear-gradient(135deg, #DC143C 0%, #FF4500 50%, #FFD700 100%)',
      pattern: (
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <radialGradient id="chuanju-grad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#FFD700" />
              <stop offset="40%" stopColor="#FF4500" />
              <stop offset="80%" stopColor="#DC143C" />
              <stop offset="100%" stopColor="#8B0000" />
            </radialGradient>
            <filter id="fire-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="400" height="400" fill="url(#chuanju-grad)" />

          {/* 变脸面具 */}
          <g transform="translate(200, 200)" filter="url(#fire-glow)">
            {/* 脸部轮廓 */}
            <ellipse
              cx="0"
              cy="0"
              rx="85"
              ry="95"
              fill="rgba(139,0,0,0.6)"
              stroke="#FFD700"
              strokeWidth="3"
            />

            {/* 对称的戏曲脸谱 */}
            <path
              d="M -60,-40 Q -75,-20 -65,10 Q -55,30 -40,40"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M 60,-40 Q 75,-20 65,10 Q 55,30 40,40"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="4"
              fill="none"
            />

            {/* 眼睛 */}
            <ellipse cx="-35" cy="-20" rx="18" ry="14" fill="#FFFFFF" />
            <ellipse cx="35" cy="-20" rx="18" ry="14" fill="#FFFFFF" />
            <circle cx="-35" cy="-20" r="8" fill="#000000" />
            <circle cx="35" cy="-20" r="8" fill="#000000" />
            <circle cx="-33" cy="-22" r="3" fill="#FFFFFF" />
            <circle cx="37" cy="-22" r="3" fill="#FFFFFF" />

            {/* 眉毛 */}
            <path d="M -55,-40 Q -35,-55 -15,-38" stroke="#FFD700" strokeWidth="4" fill="none" />
            <path d="M 55,-40 Q 35,-55 15,-38" stroke="#FFD700" strokeWidth="4" fill="none" />

            {/* 鼻子 */}
            <path
              d="M 0,-10 L -8,25 L 0,35 L 8,25 Z"
              fill="rgba(255,215,0,0.6)"
              stroke="#FFD700"
              strokeWidth="2"
            />

            {/* 嘴巴 */}
            <path
              d="M -25,55 Q 0,72 25,55"
              stroke="#FF0000"
              strokeWidth="4"
              fill="rgba(255,0,0,0.5)"
            />

            {/* 头饰 */}
            <path d="M -70,-70 L 0,-130 L 70,-70" fill="none" stroke="#FFD700" strokeWidth="4" />
            <path d="M -60,-78 L 0,-118 L 60,-78" fill="none" stroke="#FFD700" strokeWidth="2" />

            {/* 装饰珠子 */}
            <circle cx="-70" cy="-68" r="6" fill="#FFD700" />
            <circle cx="70" cy="-68" r="6" fill="#FFD700" />
            <circle cx="0" cy="-128" r="8" fill="#FF0000" stroke="#FFD700" strokeWidth="2" />

            {/* 脸颊装饰 */}
            <circle
              cx="-55"
              cy="20"
              r="12"
              fill="rgba(255,0,0,0.5)"
              stroke="#FFD700"
              strokeWidth="1.5"
            />
            <circle
              cx="55"
              cy="20"
              r="12"
              fill="rgba(255,0,0,0.5)"
              stroke="#FFD700"
              strokeWidth="1.5"
            />
          </g>

          {/* 火焰特效 */}
          <g opacity="0.3">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 5,-10; 0,0; -5,-10; 0,0"
              dur="3s"
              repeatCount="indefinite"
            />
            <path
              d="M 350,300 Q 360,280 365,260 Q 370,240 368,220 Q 372,235 375,250 Q 380,270 378,290 Q 382,295 380,310 Z"
              fill="rgba(255,140,0,0.6)"
            />
            <path
              d="M 50,320 Q 45,300 48,280 Q 52,260 50,245 Q 54,260 56,280 Q 58,300 55,315 Z"
              fill="rgba(255,69,0,0.5)"
            />
          </g>
        </svg>
      ),
    },
  ];

  return images;
};

export default HeritageImages;
export { HeritageImages };
