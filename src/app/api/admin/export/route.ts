import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
    const supabase = await createClient()

    // 1. 验证管理员权限
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 2. 获取所有链接数据
    const { data: links, error } = await supabase
        .from('links')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!links || links.length === 0) {
        return NextResponse.json({ error: "No links found" }, { status: 404 })
    }

    // 3. 生成 CSV 内容
    // 定义 CSV 头部
    const headers = [
        "ID",
        "Short Code",
        "Original URL",
        "Created At",
        "Expires At",
        "Visits",
        "Creator ID",
        "Title",
        "Description"
    ]

    // 转换数据为 CSV 格式
    const csvRows = [headers.join(",")]

    links.forEach(link => {
        const row = [
            link.id,
            link.short_code,
            `"${(link.original_url || '').replace(/"/g, '""')}"`, // 处理可能包含逗号或双引号的 URL
            link.created_at,
            link.expires_at || '',
            link.visits || 0,
            link.user_id || '',
            `"${(link.title || '').replace(/"/g, '""')}"`,
            `"${(link.description || '').replace(/"/g, '""')}"`
        ]
        csvRows.push(row.join(","))
    })

    const csvContent = csvRows.join("\n")

    // 4. 返回 CSV 文件
    // 添加 UTF-8 BOM 以防止 Excel 打开乱码
    const bom = "\uFEFF"

    return new NextResponse(bom + csvContent, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="links_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
    })
}
