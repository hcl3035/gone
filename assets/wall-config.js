// wall-config.js - 全局配置和状态管理
(function() {
    'use strict';

    // 暴露给其他模块的全局状态
    window.WallState = {
        // 图片计数器
        imageCounter: 0,
        currentDate: '',
        userId: '',

        // 图片查看器状态
        currentImageIndex: 0,
        currentScale: 1,
        allImages: [],

        // 拖拽状态
        isDragging: false,
        startX: 0,
        startY: 0,
        translateX: 0,
        translateY: 0,

        // 涂鸦状态
        isDrawingMode: false,
        isDrawing: false,
        drawColor: '#FF0000',
        drawWidth: 3,
        drawOpacity: 1,

        // 图层状态
        currentTool: 'brush',
        textAnnotations: [],
        shapeAnnotations: [],
        layers: [{ name: '图层 1', visible: true, locked: false }],
        layerCanvases: [],
        activeCanvasIndex: 0,
        drawingHistory: [],
        redoHistory: [],

        // 水印配置
        watermarkConfig: {
            enabled: false,
            showLocation: false,
            showDate: true,
            customText: '',
            position: 'bottom-right',
            opacity: 0.7,
            fontSize: 16,
            color: '#FFFFFF'
        },
        currentLocation: null,

        // 图片存储
        uploadedImages: {},
        imageStore: {},
        globalImageNumber: 0
    };

    // 工具函数
    window.WallUtils = {
        // 显示通知
        showNotification: function(message, duration) {
            let notification = document.getElementById('copyNotification');
            if (!notification) {
                notification = document.createElement('div');
                notification.id = 'copyNotification';
                notification.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #4CAF50;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 4px;
                    z-index: 10000;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                document.body.appendChild(notification);
            }

            notification.textContent = message || '操作成功';
            notification.style.opacity = '1';
            setTimeout(function() {
                notification.style.opacity = '0';
            }, duration || 1500);
        },

        // 生成唯一ID
        generateId: function() {
            return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
        },

        // 获取当前日期字符串
        getCurrentDate: function() {
            const today = new Date();
            return today.getFullYear().toString().substr(-2) +
                String(today.getMonth() + 1).padStart(2, '0') +
                String(today.getDate()).padStart(2, '0');
        }
    };
})();
