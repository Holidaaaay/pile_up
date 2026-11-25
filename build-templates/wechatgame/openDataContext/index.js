const SCORE_KEY = 'pile_up_best_balance_v1';
const RANK_TYPE = 'pile-up-friends';
const PAGE_SIZE = 7;
const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext('2d');
let generation = 0;
let page = 0;
let rows = [];
let ownScore = 0;
let status = '';
let syncFailed = false;
let queue = Promise.resolve();

function request(method, options) {
    return new Promise((success, fail) => wx[method]({ ...options, success, fail }));
}

function readBalance(storage) {
    const entry = storage && storage.find(({ key }) => key === SCORE_KEY);
    if (!entry) return null;
    try {
        const score = JSON.parse(entry.value).wxgame.score;
        return Number.isSafeInteger(score) && score > 0 ? score : null;
    } catch (_) {
        return null;
    }
}

async function loadRank(session, localScore) {
    if (session !== generation) return;
    let syncProblem = false;
    let personal = localScore;
    try {
        const user = await request('getUserCloudStorage', { keyList: [SCORE_KEY] });
        if (session !== generation) return;
        const cloudScore = readBalance(user.KVDataList) || 0;
        if (localScore > cloudScore) {
            const value = JSON.stringify({ wxgame: { score: localScore, update_time: Math.floor(Date.now() / 1000) } });
            await request('setUserCloudStorage', { KVDataList: [{ key: SCORE_KEY, value }] });
        }
        personal = Math.max(localScore, cloudScore);
    } catch (_) {
        syncProblem = true;
    }

    if (session !== generation) return;
    try {
        const result = await request('getFriendCloudStorage', { keyList: [SCORE_KEY] });
        if (session !== generation) return;
        let previousScore = 0;
        let rank = 0;
        rows = (result.data || []).map((friend) => ({
            name: friend.nickname || '微信好友',
            score: readBalance(friend.KVDataList),
        })).filter((friend) => friend.score !== null)
            .sort((left, right) => right.score - left.score)
            .map((friend, index) => {
                if (friend.score !== previousScore) rank = index + 1;
                previousScore = friend.score;
                return { ...friend, rank };
            });
        status = rows.length ? '' : '好友暂时没有可显示的成绩';
    } catch (_) {
        if (session !== generation) return;
        status = '暂时无法读取好友成绩，请刷新';
    }
    ownScore = personal;
    syncFailed = syncProblem;
    render();
}

function text(value, x, y, size, color, align = 'left', width) {
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if (width) ctx.fillText(value, x, y, width);
    else ctx.fillText(value, x, y);
}

function render() {
    if (!canvas.width || !canvas.height) return;
    ctx.setTransform(canvas.width / 640, 0, 0, canvas.height / 960, 0, 0);
    ctx.clearRect(0, 0, 640, 960);
    ctx.fillStyle = '#E8EDD9';
    ctx.fillRect(0, 0, 640, 84);
    text('我的最高余额', 26, 42, 33, '#385B44');
    text(ownScore > 0 ? '$' + ownScore : '暂无', 614, 42, 36, '#385B44', 'right');
    if (status) text(status, 320, 456, 31, '#735D4C', 'center', 570);
    rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((row, index) => {
        const y = 122 + index * 103;
        ctx.fillStyle = index % 2 ? '#FAEEDA' : '#F5E4C8';
        ctx.fillRect(0, y, 640, 90);
        text(String(row.rank), 52, y + 45, 38, row.rank <= 3 ? '#A16046' : '#735D4C', 'center');
        const name = Array.from(String(row.name));
        text(name.length > 10 ? name.slice(0, 10).join('') + '…' : name.join(''),
            107, y + 45, 36, '#49382E', 'left', 340);
        text('$' + row.score, 612, y + 45, 36, '#385B44', 'right', 126);
    });
    if (rows.length) text(`${page + 1} / ${Math.ceil(rows.length / PAGE_SIZE)}`, 320, 876, 33, '#735D4C', 'center');
    if (syncFailed) text('本机成绩尚未同步，可尝试刷新', 320, 929, 29, '#97493C', 'center');
}

wx.onMessage((message) => {
    if (!message || message.type !== RANK_TYPE) return;
    if (message.event === 'show') {
        const session = ++generation;
        rows = [];
        page = 0;
        ownScore = Number.isSafeInteger(message.score) && message.score > 0 ? message.score : 0;
        syncFailed = false;
        status = '正在读取好友成绩…';
        render();
        const score = ownScore;
        queue = queue.then(() => loadRank(session, score), () => loadRank(session, score));
    } else if (message.event === 'close') {
        generation++;
    } else if (message.event === 'page' && rows.length && Math.abs(message.offset) === 1) {
        page = Math.max(0, Math.min(Math.ceil(rows.length / PAGE_SIZE) - 1, page + message.offset));
        render();
    }
});
