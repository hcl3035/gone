(function() {
    function initWallCopy() {
        const textarea = document.getElementById('wallContent');
        if (!textarea) {
            console.warn('wallContent textarea not found');
            return;
        }

        const box = textarea.closest('.box');

        // 复制功能
        textarea.addEventListener('mouseup', function() {
            const selectedText = textarea.value.substring(
                textarea.selectionStart,
                textarea.selectionEnd
            );

            if (!selectedText || selectedText.trim() === '') {
                return;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(selectedText).then(function() {
                    showCopyNotification();
                }).catch(function(err) {
                    console.error('Failed to copy: ', err);
                    fallbackCopy(selectedText);
                });
            } else {
                fallbackCopy(selectedText);
            }
        });

        // 监听textarea的resize事件，同步调整box宽度
        let isResizing = false;
        let animationFrameId = null;
        let lastBoxWidth = 0;

        function updateBoxWidth() {
            if (isResizing && box) {
                const textareaWidth = textarea.offsetWidth;
                const boxPadding = 32;
                const newWidth = textareaWidth + boxPadding;
                
                if (Math.abs(newWidth - lastBoxWidth) > 2) {
                    box.style.width = newWidth + 'px';
                    lastBoxWidth = newWidth;
                }
            }
            animationFrameId = requestAnimationFrame(updateBoxWidth);
        }

        textarea.addEventListener('mousedown', function() {
            isResizing = true;
            lastBoxWidth = box ? box.offsetWidth : 0;
            if (!animationFrameId) {
                updateBoxWidth();
            }
        });

        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
        });

        // 窗口大小改变时重置textarea和box尺寸
        let windowResizeTimeout;
        
        window.addEventListener('resize', function() {
            clearTimeout(windowResizeTimeout);
            
            // 缩短debounce时间，更快响应
            windowResizeTimeout = setTimeout(function() {
                // 清除手动调整的inline style，恢复CSS控制
                textarea.style.width = '';
                textarea.style.height = '';
                if (box) {
                    box.style.width = '';
                }
                lastBoxWidth = 0;
            }, 50);
        });

        function fallbackCopy(text) {
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = text;
            tempTextarea.style.position = 'fixed';
            tempTextarea.style.left = '-9999px';
            document.body.appendChild(tempTextarea);
            tempTextarea.select();

            try {
                document.execCommand('copy');
                showCopyNotification();
            } catch (err) {
                console.error('Fallback copy failed: ', err);
            }

            document.body.removeChild(tempTextarea);
        }

        function showCopyNotification() {
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
                notification.textContent = '已复制选中内容';
                document.body.appendChild(notification);
            }

            notification.style.opacity = '1';
            setTimeout(function() {
                notification.style.opacity = '0';
            }, 1500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWallCopy);
    } else {
        initWallCopy();
    }
})();