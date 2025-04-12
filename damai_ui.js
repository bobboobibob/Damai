(function() {
    'use strict';

    // 调试通知
    $notification.post("界面加载", "damai_ui.js 已加载", "");

    // 生成插件页面
    $ui.render({
        props: {
            title: "大麦抢票"
        },
        views: [
            {
                type: "label",
                props: {
                    id: "statusLabel",
                    text: "脚本已加载，正在监控余票...",
                    font: $font(16),
                    textColor: $color("#000000"),
                    align: $align.center
                },
                layout: function(make, view) {
                    make.center.equalTo(view.super);
                    make.width.equalTo(view.super);
                }
            },
            {
                type: "button",
                props: {
                    id: "startButton",
                    title: "开始抢票",
                    font: $font(16),
                    bgcolor: $color("#007AFF")
                },
                layout: function(make, view) {
                    make.centerX.equalTo(view.super);
                    make.top.equalTo(view.prev.bottom).offset(20);
                    make.width.equalTo(200);
                    make.height.equalTo(40);
                },
                events: {
                    tapped: function(sender) {
                        $notification.post("操作", "开始抢票", "");
                        $ui.get("statusLabel").text = "抢票中...";
                    }
                }
            }
        ]
    });
})();
