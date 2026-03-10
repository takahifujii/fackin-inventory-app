export const CATEGORY_DATA = [
    {
        large: { code: "01", name: "みずまわり" },
        medium: { code: "01-01", name: "トイレ関連" },
        small: [
            { code: "01-01-01", name: "ウォシュレット" },
            { code: "01-01-02", name: "便座" },
            { code: "01-01-03", name: "タンク部品" },
            { code: "01-01-04", name: "止水栓" },
            { code: "01-01-05", name: "フロート弁" },
            { code: "01-01-06", name: "便器本体" }
        ]
    },
    {
        large: { code: "01", name: "みずまわり" },
        medium: { code: "01-02", name: "洗面関連" },
        small: [
            { code: "01-02-01", name: "洗面化粧台" },
            { code: "01-02-02", name: "洗面水栓" },
            { code: "01-02-03", name: "排水トラップ" },
            { code: "01-02-04", name: "止水栓" },
            { code: "01-02-05", name: "ミラーキャビネット" }
        ]
    },
    {
        large: { code: "01", name: "みずまわり" },
        medium: { code: "01-03", name: "キッチン関連" },
        small: [
            { code: "01-03-01", name: "キッチン水栓" },
            { code: "01-03-02", name: "浄水器" },
            { code: "01-03-03", name: "排水ホース" },
            { code: "01-03-04", name: "レンジフード部材" }
        ]
    },
    {
        large: { code: "01", name: "みずまわり" },
        medium: { code: "01-04", name: "浴室関連" },
        small: [
            { code: "01-04-01", name: "シャワーヘッド" },
            { code: "01-04-02", name: "シャワーホース" },
            { code: "01-04-03", name: "サーモ水栓" },
            { code: "01-04-04", name: "浴室換気扇" }
        ]
    },
    {
        large: { code: "02", name: "給湯器" },
        medium: { code: "02-01", name: "給湯器本体" },
        small: [
            { code: "02-01-01", name: "エコジョーズ" },
            { code: "02-01-02", name: "従来型給湯器" },
            { code: "02-01-03", name: "追い焚き付き" }
        ]
    },
    {
        large: { code: "02", name: "給湯器" },
        medium: { code: "02-02", name: "リモコン類" },
        small: [
            { code: "02-02-01", name: "台所リモコン" },
            { code: "02-02-02", name: "浴室リモコン" },
            { code: "02-02-03", name: "マルチリモコン" }
        ]
    },
    {
        large: { code: "03", name: "配管" },
        medium: { code: "03-01", name: "給水配管" },
        small: [
            { code: "03-01-01", name: "架橋ポリエチレン管" },
            { code: "03-01-02", name: "ポリブテン管" },
            { code: "03-01-03", name: "HIVP管" }
        ]
    },
    {
        large: { code: "03", name: "配管" },
        medium: { code: "03-02", name: "排水配管" },
        small: [
            { code: "03-02-01", name: "VU管" },
            { code: "03-02-02", name: "VP管" },
            { code: "03-02-03", name: "排水継手" }
        ]
    },
    {
        large: { code: "03", name: "配管" },
        medium: { code: "03-03", name: "継手類" },
        small: [
            { code: "03-03-01", name: "エルボ" },
            { code: "03-03-02", name: "チーズ" },
            { code: "03-03-03", name: "ソケット" },
            { code: "03-03-04", name: "ニップル" }
        ]
    },
    {
        large: { code: "04", name: "電気" },
        medium: { code: "04-01", name: "配線材料" },
        small: [
            { code: "04-01-01", name: "VVFケーブル" },
            { code: "04-01-02", name: "IV線" },
            { code: "04-01-03", name: "PF管" }
        ]
    },
    {
        large: { code: "04", name: "電気" },
        medium: { code: "04-02", name: "スイッチコンセント" },
        small: [
            { code: "04-02-01", name: "コンセント" },
            { code: "04-02-02", name: "スイッチ" },
            { code: "04-02-03", name: "プレート" }
        ]
    },
    {
        large: { code: "04", name: "電気" },
        medium: { code: "04-03", name: "照明" },
        small: [
            { code: "04-03-01", name: "ダウンライト" },
            { code: "04-03-02", name: "LED電球" },
            { code: "04-03-03", name: "シーリングライト" }
        ]
    },
    {
        large: { code: "05", name: "内装" },
        medium: { code: "05-01", name: "床材" },
        small: [
            { code: "05-01-01", name: "フローリング" },
            { code: "05-01-02", name: "クッションフロア" },
            { code: "05-01-03", name: "フロアタイル" }
        ]
    },
    {
        large: { code: "05", name: "内装" },
        medium: { code: "05-02", name: "壁材" },
        small: [
            { code: "05-02-01", name: "クロス" },
            { code: "05-02-02", name: "パテ" },
            { code: "05-02-03", name: "石膏ボード" }
        ]
    },
    {
        large: { code: "05", name: "内装" },
        medium: { code: "05-03", name: "副資材" },
        small: [
            { code: "05-03-01", name: "接着剤" },
            { code: "05-03-02", name: "コーキング" },
            { code: "05-03-03", name: "両面テープ" }
        ]
    }
];

export const getLargeCategories = () => {
    const map = new Map();
    CATEGORY_DATA.forEach(d => map.set(d.large.name, d.large));
    return Array.from(map.values());
};

export const getMediumCategories = (largeName) => {
    if (!largeName) return [];
    const map = new Map();
    CATEGORY_DATA.filter(d => d.large.name === largeName)
        .forEach(d => map.set(d.medium.name, d.medium));
    return Array.from(map.values());
};

export const getSmallCategories = (largeName, mediumName) => {
    if (!largeName || !mediumName) return [];
    const block = CATEGORY_DATA.find(d => d.large.name === largeName && d.medium.name === mediumName);
    return block ? block.small : [];
};
