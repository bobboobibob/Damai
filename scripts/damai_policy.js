(function() {
    'use strict';

    // 读取用户配置（使用中文键名）
    const ticketTarget = $persistentStore.read("抢票目标") || "未设置抢票目标";
    const userId = $persistentStore.read("用户ID") || "未设置用户ID";
    const ticketMode = $persistentStore.read("抢票模式") || "自动";
    const retryCount = $persistentStore.read("重试次数") || "3";

    $notification.post("大麦策略", "damai_policy.js 已加载", `抢票目标: ${ticketTarget}, 用户ID: ${userId}, 抢票模式: ${ticketMode}, 重试次数: ${retryCount}`);

    $done();
})();
