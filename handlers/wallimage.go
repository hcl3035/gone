package handlers

import (
	"net/http"
	"strings"

	"github.com/drduh/gone/config"
)

// WallImage handles requests to download images uploaded from wall
func WallImage(app *config.App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract file ID from path: /wall-image/{id}
		path := r.URL.Path
		prefix := "/wall-image/"

		if !strings.HasPrefix(path, prefix) {
			http.NotFound(w, r)
			return
		}

		fileID := strings.TrimPrefix(path, prefix)
		if fileID == "" {
			http.NotFound(w, r)
			return
		}

		// Use FindFile method which handles concurrency safely
		file := app.FindFile(fileID)
		if file == nil {
			writeJSON(w, http.StatusNotFound, errorJSON(app.NotFound))
			app.Log.Debug("wall image not found", "id", fileID)
			return
		}

		// Set content type based on file type
		if file.Type != "" {
			w.Header().Set("Content-Type", file.Type)
		} else {
			w.Header().Set("Content-Type", "application/octet-stream")
		}

		// Send file data
		w.WriteHeader(http.StatusOK)
		w.Write(file.Data)

		app.Log.Debug("wall image served", "id", fileID, "size", len(file.Data))
	}
}
