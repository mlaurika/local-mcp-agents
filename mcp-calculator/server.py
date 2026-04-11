from fastapi import FastAPI
import uvicorn
from mcp.server.fastapi import create_mcp_fastapi_app
from mcp.server.models import InitializationOptions
import mcp.types as types
from mcp.server import Server
import ast
import operator

# Supported operators
operators = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.BitXor: operator.xor,
    ast.USub: operator.neg
}

def eval_expr(expr: str):
    """Safely evaluate a mathematical expression string."""
    try:
        node = ast.parse(expr, mode='eval').body
        def _eval(node):
            if isinstance(node, ast.Num): # Python < 3.8
                return node.n
            elif isinstance(node, ast.Constant): # Python 3.8+
                return node.value
            elif isinstance(node, ast.BinOp):
                return operators[type(node.op)](_eval(node.left), _eval(node.right))
            elif isinstance(node, ast.UnaryOp):
                return operators[type(node.op)](_eval(node.operand))
            else:
                raise TypeError(node)
        result = _eval(node)
        return str(result)
    except Exception as e:
        return f"Error evaluating expression: {str(e)}"

# Setup the MCP Server
server = Server("calculator")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="calculate",
            description="Evaluate a mathematical expression. Used for accurate math.",
            inputSchema={
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "Mathematical expression, e.g. 2 + 2"}
                },
                "required": ["expression"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    if name != "calculate":
        raise ValueError(f"Unknown tool: {name}")
    if not arguments or "expression" not in arguments:
        raise ValueError("Missing expression argument")
    
    result = eval_expr(arguments["expression"])
    return [types.TextContent(type="text", text=result)]

# Mount MCP on FastAPI using SSE transport
app = create_mcp_fastapi_app(server)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
