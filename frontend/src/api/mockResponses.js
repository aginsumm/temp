const mockKnowledgeBase = {
  武汉木雕: {
    keywords: ['武汉木雕', '木雕', '雕刻', '技法', '工艺'],
    answer: `武汉木雕是湖北省武汉市的传统工艺美术品，具有悠久的历史和独特的艺术风格。其代表性技法主要包括：

**1. 浮雕技法**
- 浅浮雕：图案凸起较浅，层次分明，适合表现细腻的纹样
- 深浮雕：图案凸起较高，立体感强，适合表现复杂的场景

**2. 透雕技法**
- 镂空雕刻：将背景部分镂空，突出主体图案
- 双面透雕：正反两面都有图案，工艺难度较高

**3. 圆雕技法**
- 立体雕刻：从多个角度进行雕刻，作品可360度观赏
- 人物圆雕：专门用于雕刻人物形象

**4. 线刻技法**
- 阴刻：在木板上刻出凹陷的线条
- 阳刻：保留线条，刻去周围部分

武汉木雕的代表作品包括黄鹤楼木雕、楚文化主题木雕等，融合了楚文化的浪漫主义风格和现代审美。`,
    entities: [
      { id: '1', name: '武汉木雕', type: 'technique', description: '湖北省武汉市传统工艺美术，融合楚文化特色' },
      { id: '2', name: '浮雕技法', type: 'technique', description: '武汉木雕核心技法之一，分为浅浮雕和深浮雕' },
      { id: '3', name: '透雕技法', type: 'technique', description: '镂空雕刻技术，工艺难度较高' },
    ],
    relatedKeywords: ['楚文化', '黄鹤楼', '传统工艺', '非物质文化遗产'],
  },

  汉绣: {
    keywords: ['汉绣', '刺绣', '针法', '绣法', '汉绣特点'],
    answer: `汉绣是流行于湖北省荆沙、武汉一带的传统刺绣艺术，与苏绣、湘绣、蜀绣、粤绣并称中国五大名绣。汉绣的基本针法丰富多样，主要包括：

**基础针法**
1. **齐针** - 最基础的针法，用于填充大面积色块
2. **套针** - 两种颜色过渡时使用，使色彩自然衔接
3. **抢针** - 用于表现花瓣、羽毛等层次感
4. **铺针** - 底层铺垫，增加绣品厚度和立体感

**特色针法**
1. **垫绣** - 汉绣独有，先垫后绣，形成浮雕效果
2. **游针** - 线条流畅，适合表现水波、云纹
3. **打籽针** - 形成颗粒状凸起，用于花蕊装饰
4. **盘金针** - 用金线盘绕，增添华贵气质

**汉绣的艺术特点**
- 色彩浓艳，对比强烈
- 构图饱满，层次分明
- 题材广泛，寓意吉祥
- 针法多变，技艺精湛

汉绣的代表作品有《黄鹤楼》、《百鸟朝凤》、《龙凤呈祥》等，体现了楚文化的浪漫主义精神。`,
    entities: [
      { id: '1', name: '汉绣', type: 'technique', description: '湖北传统刺绣艺术，中国五大名绣之一' },
      { id: '2', name: '垫绣', type: 'technique', description: '汉绣独有针法，形成浮雕效果' },
      { id: '3', name: '荆沙地区', type: 'region', description: '汉绣主要流行区域' },
    ],
    relatedKeywords: ['刺绣', '针法', '楚文化', '传统工艺', '非物质文化遗产'],
  },

  黄鹤楼: {
    keywords: ['黄鹤楼', '黄鹤楼传说', '黄鹤楼历史', '黄鹤楼故事'],
    answer: `黄鹤楼位于湖北省武汉市长江南岸的蛇山之巅，是江南三大名楼之一，有着丰富的历史传说和文化内涵。

**主要历史传说**

**1. 费文伟驾鹤成仙**
相传古代有位名叫费文伟的人，在黄鹤楼修炼得道，最终驾鹤升仙。这是黄鹤楼最著名的传说之一，楼名也由此而来。

**2. 崔颢题诗**
唐代诗人崔颢登临黄鹤楼，写下千古名篇《黄鹤楼》：
"昔人已乘黄鹤去，此地空余黄鹤楼。
黄鹤一去不复返，白云千载空悠悠。
晴川历历汉阳树，芳草萋萋鹦鹉洲。
日暮乡关何处是？烟波江上使人愁。"

**3. 李白搁笔**
李白登黄鹤楼本欲赋诗，见崔颢之诗后叹道："眼前有景道不得，崔颢题诗在上头。"遂搁笔而去。

**4. 吕洞宾醉酒**
传说八仙之一的吕洞宾曾在此饮酒，留下"三醉岳阳人不识，朗吟飞过洞庭湖"的诗句。

**历史沿革**
- 始建于三国时期（公元223年）
- 历代屡毁屡建，现存建筑为1985年重建
- 享有"天下江山第一楼"的美誉`,
    entities: [
      { id: '1', name: '黄鹤楼', type: 'work', description: '江南三大名楼之一，武汉地标建筑' },
      { id: '2', name: '崔颢', type: 'inheritor', description: '唐代诗人，留下千古名篇《黄鹤楼》' },
      { id: '3', name: '李白', type: 'inheritor', description: '唐代诗仙，与黄鹤楼有著名典故' },
      { id: '4', name: '武汉', type: 'region', description: '黄鹤楼所在地，湖北省省会' },
    ],
    relatedKeywords: ['诗词', '传说', '江南名楼', '唐代', '文化遗产'],
  },

  楚文化: {
    keywords: ['楚文化', '楚文化特征', '楚文化核心', '楚国文化'],
    answer: `楚文化是中国古代楚国人创造的一种区域文化，以湖北、湖南为中心，具有独特的艺术风格和精神内涵。

**楚文化的核心特征**

**1. 浪漫主义精神**
- 追求自由奔放的艺术表达
- 充满想象力和创造力
- 楚辞文学是浪漫主义的典范

**2. 巫鬼文化传统**
- 崇尚祭祀，信奉神灵
- 楚人好巫鬼，重淫祀
- 影响了楚地艺术和民俗

**3. 凤鸟图腾崇拜**
- 楚人视凤为图腾
- "楚人崇凤"成为文化标识
- 凤鸟纹样广泛应用于器物装饰

**4. 开放包容态度**
- 吸收中原文化和周边文化
- 形成独特的楚式风格
- 兼收并蓄，创新发展

**代表性元素**
- **文学**：楚辞、离骚、九歌
- **艺术**：漆器、青铜器、丝绸
- **建筑**：楚式建筑风格
- **音乐**：编钟、楚歌

**现代传承**
楚文化元素在现代设计中广泛应用，如武汉的城市形象、文创产品、非遗传承等，展现了传统文化的当代价值。`,
    entities: [
      { id: '1', name: '楚文化', type: 'pattern', description: '中国古代区域文化，以湖北湖南为中心' },
      { id: '2', name: '楚辞', type: 'work', description: '楚文化代表文学，浪漫主义典范' },
      { id: '3', name: '凤鸟图腾', type: 'pattern', description: '楚文化核心符号，楚人崇凤' },
      { id: '4', name: '漆器', type: 'work', description: '楚文化代表工艺，技艺精湛' },
    ],
    relatedKeywords: ['浪漫主义', '图腾', '楚辞', '漆器', '编钟', '非物质文化遗产'],
  },

  非遗保护: {
    keywords: ['非遗保护', '非物质文化遗产', '保护传统', '传承', '传统技艺保护'],
    answer: `保护传统技艺和非物质文化遗产是一项系统工程，需要政府、社会和个人多方参与。

**保护传统技艺的主要方式**

**1. 立法保护**
- 制定《非物质文化遗产法》
- 建立非遗名录体系
- 设立传承人认定制度

**2. 传承人培养**
- 确立代表性传承人
- 提供传承补贴和场地
- 鼓励师徒传承和家族传承

**3. 生产性保护**
- 将传统技艺与现代生活结合
- 开发文创产品
- 建立生产性保护示范基地

**4. 数字化保护**
- 建立非遗数据库
- 记录技艺流程
- 利用VR/AR技术展示

**5. 教育传播**
- 非遗进校园
- 举办展览和体验活动
- 媒体宣传推广

**个人可以做的**
- 了解和学习传统技艺
- 购买非遗产品支持传承
- 参与非遗体验活动
- 传播非遗知识

**湖北非遗代表**
湖北省拥有丰富的非遗资源，如汉绣、武汉木雕、黄梅戏、武当武术等，都在积极进行保护传承工作。`,
    entities: [
      { id: '1', name: '非物质文化遗产', type: 'pattern', description: '传统文化表现形式，需要保护传承' },
      { id: '2', name: '传承人', type: 'inheritor', description: '非遗技艺的持有者和传承者' },
      { id: '3', name: '生产性保护', type: 'technique', description: '将传统技艺与现代生活结合的保护方式' },
    ],
    relatedKeywords: ['传承人', '立法保护', '数字化', '文创产品', '教育传播'],
  },

  武汉非遗: {
    keywords: ['武汉非遗', '武汉非物质文化遗产', '武汉传统', '武汉文化'],
    answer: `武汉市拥有丰富的非物质文化遗产资源，涵盖传统技艺、传统美术、传统音乐、传统舞蹈等多个类别。

**武汉市主要非物质文化遗产**

**传统技艺类**
1. **汉绣** - 国家级非遗，中国五大名绣之一
2. **武汉木雕** - 省级非遗，融合楚文化特色
3. **武汉剪纸** - 市级非遗，风格细腻传神
4. **武汉面塑** - 民间艺术，造型生动

**传统美术类**
1. **黄鹤楼传说** - 国家级非遗，民间文学
2. **木兰传说** - 国家级非遗，巾帼英雄故事

**传统音乐类**
1. **汉剧** - 国家级非遗，湖北地方戏曲
2. **湖北大鼓** - 省级非遗，说唱艺术
3. **武汉民歌** - 地方特色音乐

**传统舞蹈类**
1. **高龙** - 国家级非遗，舞龙艺术
2. **采莲船** - 民间舞蹈，节庆表演

**传统医药类**
1. **叶开泰中医药** - 中华老字号
2. **马应龙眼药制作技艺** - 传统制药

**体验推荐**
- 武汉非遗展示馆
- 汉绣博物馆
- 黄鹤楼文化景区
- 汉口里非遗街区`,
    entities: [
      { id: '1', name: '汉绣', type: 'technique', description: '国家级非遗，武汉代表性传统技艺' },
      { id: '2', name: '武汉木雕', type: 'technique', description: '省级非遗，楚文化特色工艺' },
      { id: '3', name: '黄鹤楼传说', type: 'work', description: '国家级非遗，民间文学瑰宝' },
      { id: '4', name: '高龙', type: 'pattern', description: '国家级非遗，武汉特色舞龙艺术' },
    ],
    relatedKeywords: ['汉绣', '木雕', '汉剧', '黄鹤楼', '传统技艺'],
  },

  编钟: {
    keywords: ['编钟', '曾侯乙编钟', '古乐器', '编钟音乐'],
    answer: `编钟是中国古代重要的打击乐器，其中曾侯乙编钟是迄今发现规模最大、保存最完好的编钟。

**曾侯乙编钟简介**
- **年代**：战国早期（约公元前433年）
- **出土地**：湖北随州曾侯乙墓
- **规模**：全套编钟共65件，总重约2500公斤
- **音域**：跨越五个半八度，能演奏复杂乐曲

**编钟的艺术价值**

**1. 音乐成就**
- 十二平均律的早期实践
- 一钟双音的铸造技术
- 可演奏现代乐曲

**2. 铸造工艺**
- 精确的调音技术
- 优美的造型设计
- 精细的纹饰雕刻

**3. 文化意义**
- 体现礼乐文明
- 反映等级制度
- 展现楚文化特色

**现代传承**
- 湖北省博物馆编钟乐团定期演出
- 编钟音乐走向世界
- 文创产品开发推广`,
    entities: [
      { id: '1', name: '曾侯乙编钟', type: 'work', description: '战国早期编钟，国宝级文物' },
      { id: '2', name: '曾侯乙', type: 'inheritor', description: '曾国国君，编钟所有者' },
      { id: '3', name: '随州', type: 'region', description: '曾侯乙编钟出土地' },
    ],
    relatedKeywords: ['古乐器', '战国', '楚文化', '礼乐文明', '湖北省博物馆'],
  },
};

const smartResponses = {
  greeting: {
    patterns: ['你好', '您好', '嗨', 'hi', 'hello', '早上好', '下午好', '晚上好'],
    responses: [
      '您好！很高兴为您服务。我是非遗数字生命的智能助手，可以为您解答关于武汉非物质文化遗产、楚文化、传统技艺等方面的问题。请问有什么可以帮您的吗？',
      '您好！欢迎来到非遗数字生命互动平台。我可以为您介绍武汉木雕、汉绣、黄鹤楼传说等丰富的非遗文化内容，请问您想了解什么呢？',
    ],
  },

  thanks: {
    patterns: ['谢谢', '感谢', '多谢', 'thanks'],
    responses: [
      '不客气！能为您解答是我的荣幸。如果您还有其他问题，随时可以继续提问。',
      '很高兴能帮到您！非遗文化的传承需要我们共同关注，欢迎继续探索更多精彩内容。',
    ],
  },

  farewell: {
    patterns: ['再见', '拜拜', 'bye', '下次见'],
    responses: [
      '再见！期待下次与您交流非遗文化。祝您生活愉快！',
      '感谢您的访问，期待下次再见！非遗文化的大门永远为您敞开。',
    ],
  },

  introduction: {
    patterns: ['你是谁', '介绍一下自己', '你是什么', '你能做什么'],
    responses: [
      '我是非遗数字生命互动引擎的智能助手，专注于武汉非物质文化遗产和楚文化的知识服务。我可以为您解答关于汉绣、武汉木雕、黄鹤楼传说、编钟艺术等丰富的非遗内容，帮助您深入了解传统文化的魅力。',
    ],
  },

  unknown: {
    responses: [
      '这是一个很有意思的问题！虽然我目前的知识库中还没有相关内容，但我会持续学习。您可以尝试问我关于武汉木雕、汉绣、黄鹤楼传说、楚文化等话题，我会尽力为您提供专业的解答。',
      '感谢您的提问！这个问题超出了我目前的知识范围。不过，我对武汉的非物质文化遗产有深入了解，比如汉绣的针法、武汉木雕的技法、黄鹤楼的历史传说等，欢迎继续探讨！',
      '您的问题很有深度！虽然我暂时无法给出准确答案，但我可以为您介绍武汉丰富的非遗文化。从精美的汉绣到古朴的木雕，从悠扬的编钟到传奇的黄鹤楼，每一项都蕴含着深厚的文化底蕴。',
      '这是一个值得探讨的话题！目前我的专长是武汉非物质文化遗产领域，包括传统技艺、民间文学、传统音乐等。如果您对这些话题感兴趣，我很乐意为您详细解答。',
      '感谢您的好奇心！虽然这个问题我暂时无法回答，但我会不断学习进步。您可以问我关于楚文化的浪漫主义精神、汉绣的独特针法、或者黄鹤楼的千年传说，我会尽力为您提供有价值的信息。',
    ],
  },

  suggestion: {
    patterns: ['推荐', '建议', '有什么', '可以看', '值得看'],
    responses: [
      '根据您的兴趣，我为您推荐以下内容：\n\n**传统技艺体验**\n- 汉绣博物馆：欣赏精美绣品，了解针法技艺\n- 武汉木雕工作室：观看匠人创作，感受木雕魅力\n\n**文化景点游览**\n- 黄鹤楼：登楼远眺，品味千年诗意\n- 湖北省博物馆：观赏曾侯乙编钟，聆听千古之音\n\n**非遗活动参与**\n- 汉口里非遗街区：体验传统手工艺\n- 各类非遗展览和节庆活动\n\n请问您对哪个方面更感兴趣呢？',
    ],
  },
};

const keywordMappings = {
  技法: ['技法', '技术', '方法', '技巧', '工艺'],
  历史: ['历史', '由来', '起源', '发展', '演变'],
  特点: ['特点', '特色', '特征', '风格', '风格特点'],
  代表: ['代表', '代表作', '著名', '知名', '经典'],
  传承: ['传承', '继承', '传人', '继承人'],
  保护: ['保护', '保存', '维护', '传承保护'],
  体验: ['体验', '参观', '游览', '观看', '欣赏'],
  学习: ['学习', '学会', '入门', '教程', '怎么学'],
};

function findBestMatch(question) {
  const normalizedQuestion = question.toLowerCase().trim();

  for (const [key, data] of Object.entries(mockKnowledgeBase)) {
    for (const keyword of data.keywords) {
      if (normalizedQuestion.includes(keyword.toLowerCase())) {
        return {
          matched: true,
          data: data,
          confidence: 0.9,
        };
      }
    }
  }

  for (const [category, config] of Object.entries(smartResponses)) {
    if (category === 'unknown') continue;
    for (const pattern of config.patterns) {
      if (normalizedQuestion.includes(pattern.toLowerCase())) {
        return {
          matched: true,
          data: {
            answer: config.responses[Math.floor(Math.random() * config.responses.length)],
            entities: [],
            relatedKeywords: [],
          },
          confidence: 0.8,
          category: category,
        };
      }
    }
  }

  for (const [key, data] of Object.entries(mockKnowledgeBase)) {
    for (const keyword of data.keywords) {
      const similarity = calculateSimilarity(normalizedQuestion, keyword.toLowerCase());
      if (similarity > 0.6) {
        return {
          matched: true,
          data: data,
          confidence: similarity,
        };
      }
    }
  }

  return {
    matched: false,
    data: {
      answer: smartResponses.unknown.responses[Math.floor(Math.random() * smartResponses.unknown.responses.length)],
      entities: [],
      relatedKeywords: ['非遗文化', '传统技艺', '楚文化'],
    },
    confidence: 0,
  };
}

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let matchCount = 0;

  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.includes(word2) || word2.includes(word1)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / Math.max(words1.length, words2.length);
}

function generateContextualResponse(question, matchResult) {
  const { data, confidence, category } = matchResult;

  let response = data.answer;

  if (confidence < 0.9 && confidence > 0.6 && !category) {
    const prefixes = [
      '根据您的问题，我为您找到了相关信息：\n\n',
      '这是一个很好的问题！让我为您解答：\n\n',
      '关于这个问题，我整理了以下内容：\n\n',
    ];
    response = prefixes[Math.floor(Math.random() * prefixes.length)] + response;
  }

  if (data.relatedKeywords && data.relatedKeywords.length > 0) {
    const suffixes = [
      `\n\n**相关话题**：${data.relatedKeywords.slice(0, 4).join('、')}`,
      `\n\n您可能还对以下内容感兴趣：${data.relatedKeywords.slice(0, 3).join('、')}`,
    ];
    response += suffixes[Math.floor(Math.random() * suffixes.length)];
  }

  return {
    answer: response,
    entities: data.entities || [],
    keywords: data.relatedKeywords || [],
  };
}

export function generateMockResponse(question) {
  const matchResult = findBestMatch(question);
  const response = generateContextualResponse(question, matchResult);

  return {
    messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content: response.answer,
    role: 'assistant',
    sources: [],
    entities: response.entities,
    keywords: response.keywords,
    createdAt: new Date().toISOString(),
  };
}

export function getMockRecommendedQuestions() {
  const questions = [
    { id: '1', question: '武汉木雕有哪些代表性技法？' },
    { id: '2', question: '汉绣的基本针法有哪些？' },
    { id: '3', question: '黄鹤楼的历史传说有哪些？' },
    { id: '4', question: '楚文化的核心特征是什么？' },
    { id: '5', question: '如何保护传统技艺？' },
    { id: '6', question: '武汉有哪些非物质文化遗产？' },
    { id: '7', question: '曾侯乙编钟有什么特点？' },
  ];

  return questions.sort(() => Math.random() - 0.5).slice(0, 5);
}

export default {
  generateMockResponse,
  getMockRecommendedQuestions,
};
