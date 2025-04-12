(function() {
    'use strict';

    // 读取动态策略
    const policy = $persistentStore.read("damai_policy") || 'DIRECT';

    // 测试请求，确保策略生效
    $httpClient.get({
        url: 'https://api.damai.cn/',
        policy: policy,
        headers: {
            'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)'
        }
    }, (error, response, data) => {
        if (error || response.status !== 200) {
            $notification.post("策略测试失败", "damai_ui.js 加载失败", error || '未知错误');
        } else {
            $notification.post("大麦抢票", "damai_ui.js 已加载", "抢票状态：运行中");
        }
        $done();
    });
})();
