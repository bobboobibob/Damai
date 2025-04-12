(function() {
    'use strict';

    // 调试通知
    $notification.post("脚本加载", "damai_ticket.js 已加载", "");

    // 添加可视化输出
    $ui.render({
        props: {
            title: "大麦抢票"
        },
        views: [
            {
                type: "label",
                props: {
                    text: "脚本已加载，正在监控余票...",
                    font: $font(16),
                    textColor: $color("#000000"),
                    align: $align.center
                },
                layout: function(make, view) {
                    make.center.equalTo(view.super);
                    make.width.equalTo(view.super);
                }
            }
        ]
    });

    // 配置项
    const CONFIG = {
        TICKET_URL: 'https://m.damai.cn/shows/item.html?itemId=902193434418',
        TARGET_DATE: '2025-05-03',
        TARGET_PRICE: '1280',
        MAX_RETRIES: 3,
        CHECK_INTERVAL: 1000,
        NOTIFY_URL: ''
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
                    'Cookie': $request.headers.Cookie || ''
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
                    $notification.post("API 响应", JSON.stringify(json), "");
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
                    resolve(info);
                } catch (e) {
                    reject('解析演出信息失败：' + e.message);
                }
            });
        });
    }

    // 发送通知
    function sendNotification(title, message) {
        if (CONFIG.NOTIFY_URL) {
            $httpClient.post({
                url: CONFIG.NOTIFY_URL,
                body: JSON.stringify({ title, body: message })
            });
        }
        $notification.post(title, message, '');
    }

    // 主逻辑
    async function main() {
        sendNotification("主逻辑启动", "开始执行抢票逻辑", "");

        const itemId = getItemId(CONFIG.TICKET_URL);
        if (!itemId) {
            sendNotification('错误', '无法从抢票链接中提取 itemId');
            return;
        }

        try {
            const eventInfo = await fetchEventInfo(itemId);
            sendNotification('演出信息', eventInfo);
        } catch (e) {
            sendNotification('错误', e);
        }
    }

    // 直接执行主逻辑
    main();
})();
