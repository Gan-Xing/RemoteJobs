//! WebAssembly 端批量缓冲 + 简单 K-Means 实现

use wasm_bindgen::prelude::*;
use ndarray::ArrayView2;
use once_cell::sync::Lazy;
use std::sync::Mutex;

/// 设置 panic hook 以便在 WASM 中更好地调试
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}

/// 运行期缓冲
struct Buf {
    dim: usize,
    k:   usize,
    v:   Vec<f64>,       // 用 f64，省一次类型转换
}

impl Buf {
    fn new(dim: usize, k: usize) -> Self {
        Self { dim, k, v: Vec::new() }
    }
}

/// 全局可变状态
static G: Lazy<Mutex<Option<Buf>>> = Lazy::new(|| Mutex::new(None));

/// JS ── 初始化
#[wasm_bindgen]
pub fn kmeans_init(dim: usize, k: usize, _mini_batch: usize) -> bool {
    // 检查参数合理性
    if dim == 0 || k == 0 || k > 1000 {
        return false;
    }
    *G.lock().unwrap() = Some(Buf::new(dim, k));
    true
}

/// JS ── 推送一批 Float32Array
#[wasm_bindgen]
pub fn kmeans_push(batch: &[f32]) -> bool {
    let mut guard = match G.lock() {
        Ok(guard) => guard,
        Err(_) => return false,
    };
    
    let buf = match guard.as_mut() {
        Some(buf) => buf,
        None => return false,
    };

    if batch.len() % buf.dim != 0 {
        return false;
    }

    // f32 ➜ f64，添加内存检查
    let new_size = buf.v.len() + batch.len();
    if new_size > 100_000_000 { // 限制到约100M个f64，防止内存溢出
        return false;
    }
    
    buf.v.extend(batch.iter().map(|&x| x as f64));
    true
}

/// 简单的 K-means 实现，避免随机数问题
fn simple_kmeans(data: &ArrayView2<f64>, k: usize, max_iterations: usize) -> Vec<usize> {
    let (n, dim) = data.dim();
    let mut labels = vec![0usize; n];
    let mut centroids = vec![vec![0.0; dim]; k];
    
    // 初始化：使用等间距选择初始中心点
    for i in 0..k {
        let idx = (i * n / k).min(n - 1);
        for j in 0..dim {
            centroids[i][j] = data[[idx, j]];
        }
    }
    
    // 迭代更新
    for _iteration in 0..max_iterations {
        let mut changed = false;
        
        // 分配每个点到最近的中心
        for i in 0..n {
            let mut best_cluster = 0;
            let mut best_distance = f64::INFINITY;
            
            for c in 0..k {
                let mut distance = 0.0;
                for j in 0..dim {
                    let diff = data[[i, j]] - centroids[c][j];
                    distance += diff * diff;
                }
                
                if distance < best_distance {
                    best_distance = distance;
                    best_cluster = c;
                }
            }
            
            if labels[i] != best_cluster {
                labels[i] = best_cluster;
                changed = true;
            }
        }
        
        if !changed {
            break;
        }
        
        // 更新中心点
        let mut cluster_counts = vec![0usize; k];
        for c in 0..k {
            for j in 0..dim {
                centroids[c][j] = 0.0;
            }
        }
        
        for i in 0..n {
            let cluster = labels[i];
            cluster_counts[cluster] += 1;
            for j in 0..dim {
                centroids[cluster][j] += data[[i, j]];
            }
        }
        
        // 计算平均值并处理空簇
        for c in 0..k {
            if cluster_counts[c] > 0 {
                for j in 0..dim {
                    centroids[c][j] /= cluster_counts[c] as f64;
                }
            } else {
                // 空簇：使用距离当前中心最远的点重新初始化
                let mut max_distance = 0.0;
                let mut farthest_idx = 0;
                
                for i in 0..n {
                    let mut distance = 0.0;
                    for j in 0..dim {
                        let diff = data[[i, j]] - centroids[c][j];
                        distance += diff * diff;
                    }
                    if distance > max_distance {
                        max_distance = distance;
                        farthest_idx = i;
                    }
                }
                
                for j in 0..dim {
                    centroids[c][j] = data[[farthest_idx, j]];
                }
                labels[farthest_idx] = c;
            }
        }
    }
    
    labels
}

/// JS ── 结束并计算
#[wasm_bindgen]
pub fn kmeans_finalize() -> Option<Vec<u32>> {
    let buf = match G.lock() {
        Ok(mut guard) => guard.take(),
        Err(_) => return None,
    };
    
    let buf = match buf {
        Some(buf) => buf,
        None => return None,
    };

    let n = buf.v.len() / buf.dim;
    if n < buf.k {
        return None;
    }

    // 创建 ndarray 视图
    let view = match ArrayView2::from_shape((n, buf.dim), &buf.v) {
        Ok(view) => view,
        Err(_) => return None,
    };

    // 使用我们自己的 k-means 实现
    let labels = simple_kmeans(&view, buf.k, 100);
    Some(labels.into_iter().map(|l| l as u32).collect())
}