(function() {
    'use strict';

    // 调试通知
    $notification.post("演出信息", "damai_event.js 已加载", "");

    // 配置项
    const CONFIG = {
        TICKET_URL: 'https://m.damai.cn/shows/item.html?itemId=902193434418',
        TARGET_DATE: '2025-05-03',
        TARGET_PRICE: '1280'
    };

    // 提取 itemId
    function getItemId(url) {
        const match = url.match(/itemId=(\d+)/);
        return match ? match[1] : null;
    }

    // 获取演出信息
    function fetchEventInfo(itemId) {
        const apiUrl = `https://api.damai.cn/item/detail.getdetail.2.0?itemId=${itemId}`;
        return new Promise((resolve, reject) => {
            $httpClient.get({
                url: apiUrl,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Content-Type': 'application/json',
                    'Cookie': $persistentStore.read("damai_cookie") || ''
                }
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    if (response && (response.status === 401 || response.status === 403)) {
                        reject('登录失效，请在 大麦 App 中重新登录');
                    } else {
                        reject('获取演出信息失败：' + (error || '未知错误'));
                    }
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    let info = `演出名称: ${json.data?.itemName || '未知'}\n场次:\n`;
                    const sessions = json.data?.performList || [];
                    const prices = json.data?.priceList || [];
                    sessions.forEach(s => {
                        info += `- ${s.performTime} (ID: ${s.performId})\n`;
                    });
                    info += '票价:\n';
                    prices.forEach(p => {
                        info += `- ${p.price}元 (ID: ${p.priceId})\n`;
                    });

                    // 匹配目标场次和票价
                    let matchedSession = sessions.find(s => s.performTime.includes(CONFIG.TARGET_DATE));
                    let matchedPrice = prices.find(p => p.price == CONFIG.TARGET_PRICE);

                    if (!matchedSession || !matchedPrice) {
                        reject(`未找到匹配的场次或票价：${CONFIG.TARGET_DATE}, ${CONFIG.TARGET_PRICE}元`);
                        return;
                    }

                    // 保存 sessionId 和 priceId
                    $persistentStore.write(matchedSession.performId, "damai_session_id");
                    $persistentStore.write(matchedPrice.priceId, "damai_price_id");
                    resolve(info);
                } catch (e) {
                    reject('解析演出信息失败：' + e.message);
                }
            });
        });
    }

    // 主逻辑
    async function main() {
        const itemId = getItemId(CONFIG.TICKET_URL);
        if (!itemId) {
            $notification.post('错误', '无法从抢票链接中提取 itemId', '');
            return;
        }

        try {
            const eventInfo = await fetchEventInfo(itemId);
            $notification.post('演出信息', eventInfo, '');
        } catch (e) {
            $notification.post('错误', e, '');
        }
    }

    main();
})();
