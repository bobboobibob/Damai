(function() {
    'use strict';

    // 调试通知
    $notification.post("请求拦截", "damai_request.js 已加载", "");

    // 保存 Cookie 和请求信息
    if ($request && $request.headers && $request.headers.Cookie) {
        $persistentStore.write($request.headers.Cookie, "damai_cookie");
        $notification.post("Cookie 获取", "已保存 Cookie", "");
    }

    // 继续请求
    $done();
})();
