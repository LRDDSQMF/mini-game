import { FlavorConfig, FlavorId, StageConfig, StageDecoration } from './types';

export const OUTLINE_COLOR = '#5C3D2E';
export const INITIAL_CAKE_WIDTH = 176;
export const CAKE_HEIGHT = 38;
export const PERFECT_TOLERANCE = 6.5;

export const FLAVORS: Record<FlavorId, FlavorConfig> = {
  strawberry: {
    id: 'strawberry',
    name: '草莓奶油',
    sponge: '#FFD6A5',
    spongeShadow: '#F4BC7C',
    filling: '#FF9EBB',
    icing: '#FFF5F8',
    icingHighlight: '#FFFFFF',
    sprinkles: ['#FF4D6D', '#FFB703', '#A8E6CF'],
  },
  lemon: {
    id: 'lemon',
    name: '香草檸檬',
    sponge: '#FFE68C',
    spongeShadow: '#F5D05C',
    filling: '#FFF3B0',
    icing: '#FFFDF7',
    icingHighlight: '#FFFFFF',
    sprinkles: ['#FFB703', '#8ECAE6', '#FF85A1'],
  },
  matcha: {
    id: 'matcha',
    name: '薄荷抹茶',
    sponge: '#BCEAD5',
    spongeShadow: '#9ED5BE',
    filling: '#FFFDF9',
    icing: '#E8FFF3',
    icingHighlight: '#FFFFFF',
    sprinkles: ['#FF758F', '#FFB703', '#74C69D'],
  },
  blueberry: {
    id: 'blueberry',
    name: '藍莓優格',
    sponge: '#D8CEF2',
    spongeShadow: '#BEB0E6',
    filling: '#F3EEFF',
    icing: '#A2D2FF',
    icingHighlight: '#E0F2FE',
    sprinkles: ['#FFFFFF', '#FFAFCC', '#FFD166'],
  },
  cocoa: {
    id: 'cocoa',
    name: '可可布朗尼',
    sponge: '#C69774',
    spongeShadow: '#A97855',
    filling: '#FFE5EC',
    icing: '#7F4F24',
    icingHighlight: '#9C6644',
    sprinkles: ['#FFF9F2', '#FF9EBB', '#FFD166'],
  },
  caramel: {
    id: 'caramel',
    name: '焦糖布丁',
    sponge: '#FFD180',
    spongeShadow: '#F4B458',
    filling: '#FFF8E7',
    icing: '#FF9F1C',
    icingHighlight: '#FFBF69',
    sprinkles: ['#FFFDF9', '#FF4D6D', '#8ECAE6'],
  },
};

export const BASE_STAGES: StageConfig[] = [
  {
    stageNumber: 1,
    name: '草莓晨曦屋',
    targetLayers: 8,
    swingSpeed: 2.15,
    maxAngle: 0.56,
    widthBonus: 14,
    decoration: 'cherry',
    decorationName: '糖漬紅櫻桃',
    flavors: ['strawberry', 'lemon'],
  },
  {
    stageNumber: 2,
    name: '抹茶野餐派對',
    targetLayers: 18,
    swingSpeed: 2.48,
    maxAngle: 0.61,
    widthBonus: 16,
    decoration: 'macaron',
    decorationName: '粉彩雙馬卡龍',
    flavors: ['matcha', 'lemon', 'strawberry'],
  },
  {
    stageNumber: 3,
    name: '藍莓晚霞工坊',
    targetLayers: 30,
    swingSpeed: 2.82,
    maxAngle: 0.65,
    widthBonus: 18,
    decoration: 'candle',
    decorationName: '慶祝星光蠟燭',
    flavors: ['blueberry', 'strawberry', 'matcha'],
  },
  {
    stageNumber: 4,
    name: '焦糖可可王國',
    targetLayers: 45,
    swingSpeed: 3.16,
    maxAngle: 0.68,
    widthBonus: 20,
    decoration: 'crown',
    decorationName: '皇家糖霜皇冠',
    flavors: ['cocoa', 'caramel', 'strawberry'],
  },
  {
    stageNumber: 5,
    name: '星空糖果城堡',
    targetLayers: 60,
    swingSpeed: 3.45,
    maxAngle: 0.71,
    widthBonus: 22,
    decoration: 'pennant',
    decorationName: '夢幻慶典彩旗',
    flavors: ['strawberry', 'lemon', 'matcha', 'blueberry', 'cocoa', 'caramel'],
  },
];

export function getStageForLayerCount(layers: number): {
  stage: StageConfig;
  startLayer: number;
} {
  let prevTarget = 0;
  for (const stage of BASE_STAGES) {
    if (layers < stage.targetLayers) {
      return { stage, startLayer: prevTarget };
    }
    prevTarget = stage.targetLayers;
  }

  // Endless stages every 15 layers after stage 5
  const extraIndex = Math.floor((layers - 60) / 15) + 1;
  const stageNumber = 5 + extraIndex;
  const startLayer = 60 + (extraIndex - 1) * 15;
  const targetLayers = startLayer + 15;
  const decorations: StageDecoration[] = ['cherry', 'macaron', 'candle', 'crown', 'pennant'];
  const decorationNames: Record<StageDecoration, string> = {
    cherry: '糖漬紅櫻桃',
    macaron: '粉彩雙馬卡龍',
    candle: '慶祝星光蠟燭',
    crown: '皇家糖霜皇冠',
    pennant: '夢幻慶典彩旗',
  };
  const decoration = decorations[(stageNumber - 1) % decorations.length];

  return {
    startLayer,
    stage: {
      stageNumber,
      name: `雲端傳說 第 ${stageNumber} 層區`,
      targetLayers,
      swingSpeed: Math.min(4.4, 3.45 + extraIndex * 0.16),
      maxAngle: Math.min(0.76, 0.71 + extraIndex * 0.01),
      widthBonus: 20,
      decoration,
      decorationName: decorationNames[decoration],
      flavors: ['strawberry', 'lemon', 'matcha', 'blueberry', 'cocoa', 'caramel'],
    },
  };
}

export function getPatissierRank(layers: number): string {
  if (layers >= 60) return '夢幻雲端蛋糕國王';
  if (layers >= 45) return '皇家焦糖甜點大師';
  if (layers >= 30) return '星空糖霜主廚';
  if (layers >= 18) return '粉彩烘焙達人';
  if (layers >= 8) return '草莓裱花學徒';
  return '見習小點心師';
}
