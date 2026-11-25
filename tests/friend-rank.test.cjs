const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const key = 'pile_up_best_balance_v1';
const type = 'pile-up-friends';
const source = fs.readFileSync(`${__dirname}/../build-templates/wechatgame/openDataContext/index.js`, 'utf8');
const balance = (score) => [{ key, value: JSON.stringify({ wxgame: { score } }) }];

function start(baseline, friends = []) {
    let receive;
    let drawn = [];
    let cloud = baseline;
    const writes = [];
    const frame = {
        setTransform() {}, clearRect() { drawn = []; }, fillRect() {}, fillText(text) { drawn.push(text); },
    };
    const wx = {
        getSharedCanvas: () => ({ width: 640, height: 960, getContext: () => frame }),
        onMessage: (listener) => { receive = listener; },
        getUserCloudStorage: ({ success }) => success({ KVDataList: balance(cloud) }),
        getFriendCloudStorage: ({ success }) => success({ data: friends }),
        setUserCloudStorage: ({ KVDataList, success }) => {
            cloud = JSON.parse(KVDataList[0].value).wxgame.score;
            writes.push(cloud);
            success({});
        },
    };
    vm.runInNewContext(source, { wx });
    return { wx, writes, drawn: () => drawn, send: (event, extras) => receive({ type, event, ...extras }) };
}

const nextTick = () => new Promise(setImmediate);

test('keeps the higher cloud record and ranks equal scores together', async () => {
    const mock = start(70, [
        { nickname: 'A', KVDataList: balance(35) }, { nickname: 'B', KVDataList: balance(50) },
        { nickname: 'C', KVDataList: balance(50) }, { nickname: 'D', KVDataList: balance(0) },
    ]);
    mock.send('show', { score: 40 });
    await nextTick();
    assert.deepEqual(mock.writes, []);
    assert.deepEqual(mock.drawn().slice(1), ['$70', '1', 'B', '$50', '1', 'C', '$50', '3', 'A', '$35', '1 / 1']);
});

test('uploads only a new high score and paginates the full friend list', async () => {
    const mock = start(45, Array.from({ length: 8 }, (_, index) => ({
        nickname: `Friend ${index + 1}`, KVDataList: balance(80 - index),
    })));
    mock.send('show', { score: 65 });
    await nextTick();
    assert.deepEqual(mock.writes, [65]);
    assert.ok(mock.drawn().includes('1 / 2'));
    mock.send('page', { offset: 1 });
    assert.ok(mock.drawn().includes('Friend 8') && mock.drawn().includes('2 / 2'));
});

test('shows errors without overwriting an unreadable score', async () => {
    const mock = start(100);
    mock.wx.getUserCloudStorage = ({ fail }) => fail();
    mock.wx.getFriendCloudStorage = ({ fail }) => fail();
    mock.send('show', { score: 50 });
    await nextTick();
    assert.deepEqual(mock.writes, []);
    assert.ok(mock.drawn().includes('暂时无法读取好友成绩，请刷新'));
    assert.ok(mock.drawn().includes('本机成绩尚未同步，可尝试刷新'));
});

test('ignores a cloud read that completes after closing the rank', async () => {
    const mock = start(45);
    let finishRead;
    mock.wx.getUserCloudStorage = ({ success }) => { finishRead = success; };
    mock.send('show', { score: 65 });
    await nextTick();
    mock.send('close');
    finishRead({ KVDataList: balance(45) });
    await nextTick();
    assert.deepEqual(mock.writes, []);
});
