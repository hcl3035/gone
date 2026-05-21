package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/drduh/gone/config"
)

// Wall handles requests to read and modify Wall content in Storage.
func Wall(app *config.App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := authRequest(w, r, app)
		if req == nil {
			return
		}

		app.CountWall()

		if r.Method == http.MethodPost {
			if r.FormValue(formFieldClear) != "" {
				app.Log.Debug("clearing wall",
					"length", app.CharsWall, "user", req)
				app.ClearWall()
				app.Log.Info("cleared wall", "user", req)
			}

			formContent := r.FormValue(formFieldWall)
			if formContent != "" {
				app.Log.Debug("updating wall",
					"length", len(formContent), "user", req)
				app.WallContent = formContent
				
				// 同时接收图片映射（如果有）
				imageMapJSON := r.FormValue("imageMap")
				if imageMapJSON != "" {
					app.Log.Debug("received imageMap JSON", "json", imageMapJSON, "user", req)
					var imageMap map[string]string
					if err := json.Unmarshal([]byte(imageMapJSON), &imageMap); err == nil {
						app.WallImageMap = imageMap
						app.Log.Debug("updated wall image map", "count", len(imageMap), "map", imageMap, "user", req)
					} else {
						app.Log.Error("failed to parse imageMap", "error", err, "user", req)
					}
				} else {
					app.Log.Debug("no imageMap received in form", "user", req)
				}
				
				app.Log.Info("updated wall", "user", req)
			}

			if req.IsBrowser {
				toRoot(w, r, app.Root)
				return
			}
		}

		if r.URL.Query().Get("download") == "all" {
			app.ServeWall(w)
			app.Log.Info("downloaded wall", "user", req)
			return
		}

		writeJSON(w, http.StatusOK, app.WallContent)
	}
}
