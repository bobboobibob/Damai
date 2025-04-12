(function() {
    'use strict';

    // 读取用户配置
    const ticketUrl = $persistentStore.read("抢票链接") || "未设置抢票链接";
    const ticketMode = $persistentStore.read("抢票模式") || "自动";
    const retryCount = $persistentStore.read("重试次数") || "3";
    const selectedSession = $persistentStore.read("选择场次") || "未选择场次";
    const selectedPrice = $persistentStore.read("选择价位") || "未选择票价";

    $notification.post("大麦策略", "damai_policy.js 已加载", `抢票链接: ${ticketUrl}, 场次: ${selectedSession}, 票价: ${selectedPrice}, 抢票模式: ${ticketMode}, 重试次数: ${retryCount}`);

    $done();
})();
