(function() {
    'use strict';

    // 读取用户配置
    const ticketTarget = $persistentStore.read("ticketTarget") || "未设置抢票目标";
    const userId = $persistentStore.read("userId") || "未设置用户ID";
    const ticketMode = $persistentStore.read("ticketMode") || "auto";
    const retryCount = $persistentStore.read("retryCount") || "3";

    $notification.post("大麦策略", "damai_policy.js 已加载", `目标: ${ticketTarget}, 用户: ${userId}, 模式: ${ticketMode}, 重试: ${retryCount}`);

    $done();
})();
